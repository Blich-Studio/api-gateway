import { HttpModule } from '@nestjs/axios'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ArticlesResolver } from './articles.resolver'
import { ArticlesService } from './articles.service'
import { ARTICLES_SERVICE } from './contracts/articles-service.contract'

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [ArticlesResolver, { provide: ARTICLES_SERVICE, useClass: ArticlesService }],
})
export class ArticlesModule {}
