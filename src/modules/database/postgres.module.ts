import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { Pool, type QueryResult } from 'pg'

export const POSTGRES_CLIENT = 'POSTGRES_CLIENT'

export interface PostgresClient {
  query(text: string, params?: unknown[]): Promise<QueryResult<Record<string, unknown>>>
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
            process.env.NODE_ENV === 'production'
              ? {
                  rejectUnauthorized: false,
                }
              : false,
        })
      },
      inject: [ConfigService],
    },
  ],
  exports: [POSTGRES_CLIENT],
})
export class PostgresModule {}
