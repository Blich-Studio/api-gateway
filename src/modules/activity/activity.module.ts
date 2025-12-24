import { Module } from '@nestjs/common'
import { PostgresModule } from '../database/postgres.module'
import { ActivityService } from './activity.service'
import { ActivityController } from './activity.controller'
import { RolesGuard } from '../auth/guards/roles.guard'

@Module({
  imports: [PostgresModule],
  providers: [ActivityService, RolesGuard],
  controllers: [ActivityController],
  exports: [ActivityService],
})
export class ActivityModule {}
