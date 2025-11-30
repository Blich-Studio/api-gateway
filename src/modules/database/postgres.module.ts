import { Inject, Logger, Module, type OnModuleDestroy } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { Pool, type QueryResult } from 'pg'

export const POSTGRES_CLIENT = 'POSTGRES_CLIENT'

export interface PostgresClient {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: unknown[]
  ): Promise<QueryResult<T>>
  end(): Promise<void>
}

/**
 * Parse boolean value from string configuration
 * Handles: 'true', '1', 'yes' (case-insensitive)
 */
function parseBoolean(value: string | undefined, defaultValue = false): boolean {
  if (!value) return defaultValue
  const normalized = value.toLowerCase().trim()
  return normalized === 'true' || normalized === '1' || normalized === 'yes'
}

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: POSTGRES_CLIENT,
      useFactory: (configService: ConfigService) => {
        const sslEnabled = parseBoolean(configService.get<string>('POSTGRES_SSL'))
        const sslRejectUnauthorized = configService.get<string>('POSTGRES_SSL_REJECT_UNAUTHORIZED')
        const sslCa = configService.get<string>('POSTGRES_SSL_CA')

        // Warn if SSL configs are provided but SSL is not enabled
        if (!sslEnabled && (sslRejectUnauthorized || sslCa)) {
          const logger = new Logger('PostgresModule')
          logger.warn(
            'POSTGRES_SSL_REJECT_UNAUTHORIZED or POSTGRES_SSL_CA is set but POSTGRES_SSL is not enabled. SSL settings will be ignored.'
          )
        }

        return new Pool({
          host: configService.getOrThrow<string>('POSTGRES_HOST'),
          port: configService.getOrThrow<number>('POSTGRES_PORT'),
          user: configService.getOrThrow<string>('POSTGRES_USER'),
          password: configService.getOrThrow<string>('POSTGRES_PASSWORD'),
          database: configService.getOrThrow<string>('POSTGRES_DB'),
          max: configService.get<number>('POSTGRES_POOL_MAX', 20),
          idleTimeoutMillis: configService.get<number>('POSTGRES_IDLE_TIMEOUT', 30000),
          connectionTimeoutMillis: configService.get<number>('POSTGRES_CONNECTION_TIMEOUT', 2000),
          ssl: sslEnabled
            ? {
                rejectUnauthorized: parseBoolean(sslRejectUnauthorized, true),
                ...(sslCa ? { ca: sslCa } : {}),
              }
            : false,
        })
      },
      inject: [ConfigService],
    },
  ],
  exports: [POSTGRES_CLIENT],
})
export class PostgresModule implements OnModuleDestroy {
  constructor(@Inject(POSTGRES_CLIENT) private readonly postgresClient: Pool) {}

  async onModuleDestroy() {
    await this.postgresClient.end()
  }
}
