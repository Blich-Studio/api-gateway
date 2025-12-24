import { Module } from '@nestjs/common'
import { PostgresModule } from '../database/postgres.module'
import { EmailModule } from '../email/email.module'
import { UsersService } from './users.service'
import { UsersController } from './users.controller'
import { RolesGuard } from '../auth/guards/roles.guard'

@Module({
  imports: [PostgresModule, EmailModule],
  providers: [UsersService, RolesGuard],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
