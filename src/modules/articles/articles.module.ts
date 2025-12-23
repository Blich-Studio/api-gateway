import { Module } from '@nestjs/common'
import { PostgresModule } from '../database/postgres.module'
import { TagsModule } from '../tags/tags.module'
import { ArticlesController } from './articles.controller'
import { ArticlesService } from './articles.service'

@Module({
  imports: [PostgresModule, TagsModule],
  controllers: [ArticlesController],
  providers: [ArticlesService],
  exports: [ArticlesService],
})
export class ArticlesModule {}
