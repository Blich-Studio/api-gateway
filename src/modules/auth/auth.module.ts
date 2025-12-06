import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PassportModule } from '@nestjs/passport'
import { PostgresModule } from '../database/postgres.module'
import { EmailModule } from '../email/email.module'
import { UserAuthService } from './user-auth.service'
import { UserAuthController } from './user-auth.controller'
import { AuthService } from './services/auth.service'
import { AuthController } from './controllers/auth.controller'
import { JwtStrategy } from './strategies/jwt.strategy'

@Module({
  imports: [
    ConfigModule,
    PostgresModule,
    EmailModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
  providers: [UserAuthService, AuthService, JwtStrategy],
  controllers: [UserAuthController, AuthController],
  exports: [UserAuthService, AuthService],
})
export class AuthModule {}
