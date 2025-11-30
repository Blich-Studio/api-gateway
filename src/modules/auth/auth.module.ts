import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PostgresModule } from '../database/postgres.module'
import { EmailModule } from '../email/email.module'
import { UserAuthService } from './user-auth.service'
import { UserAuthController } from './user-auth.controller'

@Module({
  imports: [ConfigModule, PostgresModule, EmailModule],
  providers: [UserAuthService],
  controllers: [UserAuthController],
  exports: [UserAuthService],
})
export class AuthModule {}
