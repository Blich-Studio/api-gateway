import { HttpModule } from '@nestjs/axios'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { USERS_SERVICE } from './contracts/users-service.contract'
import { UsersService } from './users.service'

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [{ provide: USERS_SERVICE, useClass: UsersService }],
  exports: [USERS_SERVICE],
})
export class UsersModule {}
