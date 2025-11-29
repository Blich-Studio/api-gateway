import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PostgresModule } from '../database/postgres.module.js'
import { EmailModule } from '../email/email.module.js'
import { UserAuthService } from './user-auth.service.js'
import { UserAuthController } from './user-auth.controller.js'

@Module({
  imports: [ConfigModule, PostgresModule, EmailModule],
  providers: [UserAuthService],
  controllers: [UserAuthController],
  exports: [UserAuthService],
})
export class AuthModule {}
