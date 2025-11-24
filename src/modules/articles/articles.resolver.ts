import { Inject } from '@nestjs/common'
import { Args, ID, Query, Resolver } from '@nestjs/graphql'
import {
  ARTICLES_SERVICE,
  type ArticlesServiceContract,
} from './contracts/articles-service.contract'
import { Article } from './models/article.model'

@Resolver(() => Article)
export class ArticlesResolver {
  constructor(
    @Inject(ARTICLES_SERVICE) private readonly articlesService: ArticlesServiceContract
  ) {}

  @Query(() => [Article])
  async articles(): Promise<Article[]> {
    return this.articlesService.findAll()
  }

  @Query(() => Article)
  async article(@Args('id', { type: () => ID }) id: string): Promise<Article> {
    return this.articlesService.findOne(id)
  }
}
