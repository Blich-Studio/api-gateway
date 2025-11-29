import { Inject, Module, type OnModuleDestroy } from '@nestjs/common'
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
 * Handles: 'true', '1', 'yes', 'TRUE', 'Yes', etc.
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
        return new Pool({
          host: configService.getOrThrow<string>('POSTGRES_HOST'),
          port: configService.getOrThrow<number>('POSTGRES_PORT'),
          user: configService.getOrThrow<string>('POSTGRES_USER'),
          password: configService.getOrThrow<string>('POSTGRES_PASSWORD'),
          database: configService.getOrThrow<string>('POSTGRES_DB'),
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 2000,
          ssl: parseBoolean(configService.get<string>('POSTGRES_SSL'))
            ? {
                rejectUnauthorized: parseBoolean(
                  configService.get<string>('POSTGRES_SSL_REJECT_UNAUTHORIZED'),
                  true
                ),
                ...(configService.get<string>('POSTGRES_SSL_CA')
                  ? { ca: configService.get<string>('POSTGRES_SSL_CA') }
                  : {}),
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
