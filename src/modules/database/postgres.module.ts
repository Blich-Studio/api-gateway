import { Inject, Logger, Module, type OnModuleDestroy } from '@nestjs/common'
import { Pool, type QueryResult } from 'pg'
import { AppConfigModule, AppConfigService } from '../../common/config'
import { MigrationService } from './migration.service'

export const POSTGRES_CLIENT = 'POSTGRES_CLIENT'

export interface PostgresClient {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: unknown[]
  ): Promise<QueryResult<T>>
  end(): Promise<void>
}

@Module({
  imports: [AppConfigModule],
  providers: [
    MigrationService,
    {
      provide: POSTGRES_CLIENT,
      useFactory: async (appConfig: AppConfigService) => {
        const logger = new Logger('PostgresModule')

        // Warn if SSL configs are provided but SSL is not enabled
        if (!appConfig.postgresSslEnabled && appConfig.postgresSslCa) {
          logger.warn(
            'POSTGRES_SSL_CA is set but POSTGRES_SSL is not enabled. SSL settings will be ignored.'
          )
        }

        const pool = new Pool({
          host: appConfig.postgresHost,
          port: appConfig.postgresPort,
          user: appConfig.postgresUser,
          password: appConfig.postgresPassword,
          database: appConfig.postgresDatabase,
          max: appConfig.postgresPoolMax,
          idleTimeoutMillis: appConfig.postgresIdleTimeout,
          connectionTimeoutMillis: appConfig.postgresConnectionTimeout,
          ssl: appConfig.postgresSslEnabled
            ? {
                rejectUnauthorized: appConfig.postgresSslRejectUnauthorized,
                ...(appConfig.postgresSslCa ? { ca: appConfig.postgresSslCa } : {}),
              }
            : false,
        })

        // Test database connection on startup
        try {
          logger.log('Testing database connection...')
          const client = await pool.connect()
          await client.query('SELECT 1')
          client.release()
          logger.log('Database connection established successfully')
        } catch (error) {
          logger.error('Failed to connect to database', error)
          await pool.end()
          throw new Error(
            `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        }

        return pool
      },
      inject: [AppConfigService],
    },
  ],
  exports: [POSTGRES_CLIENT],
})
export class PostgresModule implements OnModuleDestroy {
  constructor(@Inject(POSTGRES_CLIENT) private readonly postgresClient: PostgresClient) {}

  async onModuleDestroy() {
    await this.postgresClient.end()
  }
}
