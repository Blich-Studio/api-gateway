import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import { POSTGRES_CLIENT, type PostgresClient } from './postgres.module'

@Injectable()
export class MigrationService implements OnModuleInit {
  private readonly logger = new Logger(MigrationService.name)

  constructor(@Inject(POSTGRES_CLIENT) private readonly postgresClient: PostgresClient) {}

  async onModuleInit() {
    await this.runMigrations()
  }

  private async runMigrations(): Promise<void> {
    this.logger.log('Starting database migrations...')

    // Create migrations tracking table if it doesn't exist
    await this.createMigrationsTable()

    // Get all migration files
    const migrationsDir = join(process.cwd(), 'database', 'migrations')
    let migrationFiles: string[]

    try {
      const files = await readdir(migrationsDir)
      migrationFiles = files.filter((f) => f.endsWith('.sql')).sort()
    } catch (error) {
      this.logger.warn(`Migrations directory not found: ${migrationsDir}`)
      return
    }

    if (migrationFiles.length === 0) {
      this.logger.log('No migration files found')
      return
    }

    // Get already applied migrations
    const appliedMigrations = await this.getAppliedMigrations()

    // Run pending migrations
    for (const file of migrationFiles) {
      if (appliedMigrations.has(file)) {
        this.logger.debug(`Skipping already applied migration: ${file}`)
        continue
      }

      await this.applyMigration(migrationsDir, file)
    }

    this.logger.log('Database migrations completed')
  }

  private async createMigrationsTable(): Promise<void> {
    await this.postgresClient.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT NOW()
      )
    `)
  }

  private async getAppliedMigrations(): Promise<Set<string>> {
    const result = await this.postgresClient.query<{ name: string }>(
      'SELECT name FROM _migrations ORDER BY id'
    )
    return new Set(result.rows.map((row) => row.name))
  }

  private async applyMigration(migrationsDir: string, filename: string): Promise<void> {
    const filepath = join(migrationsDir, filename)

    try {
      this.logger.log(`Applying migration: ${filename}`)
      const sql = await readFile(filepath, 'utf-8')

      // Run migration in a transaction
      await this.postgresClient.query('BEGIN')

      try {
        await this.postgresClient.query(sql)
        await this.postgresClient.query('INSERT INTO _migrations (name) VALUES ($1)', [filename])
        await this.postgresClient.query('COMMIT')
        this.logger.log(`Migration applied successfully: ${filename}`)
      } catch (error) {
        await this.postgresClient.query('ROLLBACK')
        throw error
      }
    } catch (error) {
      this.logger.error(`Failed to apply migration ${filename}: ${error}`)
      throw error
    }
  }
}
