import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import { POSTGRES_CLIENT, type PostgresClient } from './postgres.constants'

@Injectable()
export class MigrationService implements OnModuleInit {
  private readonly logger = new Logger(MigrationService.name)

  constructor(@Inject(POSTGRES_CLIENT) private readonly db: PostgresClient) {}

  async onModuleInit() {
    await this.runMigrations()
  }

  private async runMigrations() {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    const migrationsDir = join(process.cwd(), 'database', 'migrations')

    let files: string[]
    try {
      files = (await readdir(migrationsDir)).filter(f => f.endsWith('.sql')).sort()
    } catch {
      this.logger.warn(`Migrations directory not found at ${migrationsDir}, skipping`)
      return
    }

    // Advisory lock ensures only one instance runs migrations when multiple
    // Cloud Run instances start simultaneously during a deployment rollout.
    const lockClient = await this.db.connect()
    try {
      await lockClient.query('SELECT pg_advisory_lock(8675309)')

      // Re-query applied migrations after acquiring the lock — another instance
      // may have run some while we were waiting.
      const { rows } = await lockClient.query<{ filename: string }>(
        'SELECT filename FROM schema_migrations'
      )
      const applied = new Set(rows.map(r => r.filename))

      for (const file of files) {
        if (applied.has(file)) continue

        const sql = await readFile(join(migrationsDir, file), 'utf8')
        this.logger.log(`Running migration: ${file}`)

        const client = await this.db.connect()
        try {
          await client.query('BEGIN')
          await client.query(sql)
          await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file])
          await client.query('COMMIT')
          this.logger.log(`Migration applied: ${file}`)
        } catch (err) {
          await client.query('ROLLBACK')
          this.logger.error(`Migration failed: ${file}`, err)
          throw err
        } finally {
          client.release()
        }
      }
    } finally {
      await lockClient.query('SELECT pg_advisory_unlock(8675309)')
      lockClient.release()
    }
  }
}
