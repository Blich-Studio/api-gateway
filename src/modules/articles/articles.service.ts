import { PaginatedResponse, Article as SharedArticle } from '@blich-studio/shared'
import { HttpService } from '@nestjs/axios'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { firstValueFrom } from 'rxjs'
import type { ArticlesServiceContract } from './contracts/articles-service.contract'
import { Article } from './models/article.model'

@Injectable()
export class ArticlesService implements ArticlesServiceContract {
  private readonly cmsApiUrl: string

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService
  ) {
    this.cmsApiUrl = this.configService.getOrThrow<string>('cmsApiUrl')
  }

  async findAll(): Promise<Article[]> {
    const { data } = await firstValueFrom(
      this.httpService.get<PaginatedResponse<SharedArticle>>(`${this.cmsApiUrl}/api/articles`)
    )

    return data.data.map(article => ({
      id: article._id,
      title: article.title,
      content: article.content,
      slug: article.slug,
      perex: article.perex,
      status: article.status,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
    }))
  }

  async findOne(id: string): Promise<Article> {
    const { data } = await firstValueFrom(
      this.httpService.get<SharedArticle>(`${this.cmsApiUrl}/api/articles/${id}`)
    )

    return {
      id: data._id,
      title: data.title,
      content: data.content,
      slug: data.slug,
      perex: data.perex,
      status: data.status,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    }
  }
}
