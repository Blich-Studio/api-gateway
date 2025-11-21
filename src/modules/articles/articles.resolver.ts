import { Args, ID, Query, Resolver } from '@nestjs/graphql'
import { ArticlesService } from './articles.service'
import { Article } from './models/article.model'

@Resolver(() => Article)
export class ArticlesResolver {
  constructor(private readonly articlesService: ArticlesService) {}

  @Query(() => [Article])
  async articles(): Promise<Article[]> {
    return this.articlesService.findAll()
  }

  @Query(() => Article)
  async article(@Args('id', { type: () => ID }) id: string): Promise<Article> {
    return this.articlesService.findOne(id)
  }
}
