import { Module } from '@nestjs/common'
import { PostgresModule } from '../database/postgres.module'
import { TagsController } from './tags.controller'
import { TagsService } from './tags.service'

@Module({
  imports: [PostgresModule],
  controllers: [TagsController],
  providers: [TagsService],
  exports: [TagsService],
})
export class TagsModule {}
