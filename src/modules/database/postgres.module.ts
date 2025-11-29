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
          ssl:
            configService.get<string>('POSTGRES_SSL') === 'true'
              ? {
                  rejectUnauthorized:
                    configService.get<string>('POSTGRES_SSL_REJECT_UNAUTHORIZED', 'true') ===
                    'true',
                  ca: configService.get<string>('POSTGRES_SSL_CA'),
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
