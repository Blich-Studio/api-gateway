import { Module } from '@nestjs/common'
import { PostgresModule } from '../database/postgres.module'
import { TagsModule } from '../tags/tags.module'
import { ProjectsController } from './projects.controller'
import { ProjectsService } from './projects.service'

@Module({
  imports: [PostgresModule, TagsModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
