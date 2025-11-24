import { HttpService } from '@nestjs/axios'
import { ForbiddenException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { firstValueFrom } from 'rxjs'
import type { AuthenticatedUser } from '../auth/auth.types'
import type { EditorialServiceContract } from './contracts/editorial-service.contract'
import type { UpdateArticleDto } from './dto/update-article.dto'
import type { UpdateCommentDto } from './dto/update-comment.dto'

interface ArticleResource {
  id: string
  authorId: string
}

interface CommentResource {
  id: string
  userId: string
}

@Injectable()
export class EditorialService implements EditorialServiceContract {
  private readonly cmsApiUrl: string

  constructor(
    private readonly httpService: HttpService,
    configService: ConfigService
  ) {
    this.cmsApiUrl = configService.getOrThrow<string>('cmsApiUrl')
  }

  async updateArticle(articleId: string, payload: UpdateArticleDto, user: AuthenticatedUser) {
    const article = await this.fetchArticle(articleId)

    if (!this.canEditArticle(user, article.authorId)) {
      throw new ForbiddenException('Insufficient permissions to update article')
    }

    const response = await firstValueFrom(
      this.httpService.patch<Record<string, unknown>>(
        `${this.cmsApiUrl}/api/articles/${articleId}`,
        payload
      )
    )

    return response.data
  }

  async updateComment(commentId: string, payload: UpdateCommentDto, user: AuthenticatedUser) {
    const comment = await this.fetchComment(commentId)

    if (!this.canEditComment(user, comment.userId)) {
      throw new ForbiddenException('Insufficient permissions to update comment')
    }

    const response = await firstValueFrom(
      this.httpService.patch<Record<string, unknown>>(
        `${this.cmsApiUrl}/api/comments/${commentId}`,
        payload
      )
    )

    return response.data
  }

  async deleteTag(tagId: string, user: AuthenticatedUser) {
    if (user.role !== 'admin') {
      throw new ForbiddenException('Admin role required to delete tags')
    }

    const response = await firstValueFrom(
      this.httpService.delete<Record<string, unknown>>(`${this.cmsApiUrl}/api/tags/${tagId}`)
    )

    return response.data
  }

  async createTag(payload: Record<string, unknown>, user: AuthenticatedUser) {
    if (user.role !== 'admin') {
      throw new ForbiddenException('Admin role required to create tags')
    }

    const response = await firstValueFrom(
      this.httpService.post<Record<string, unknown>>(`${this.cmsApiUrl}/api/tags`, payload)
    )

    return response.data
  }

  private async fetchArticle(articleId: string): Promise<ArticleResource> {
    const { data } = await firstValueFrom(
      this.httpService.get<ArticleResource>(`${this.cmsApiUrl}/api/articles/${articleId}`)
    )

    return data
  }

  private async fetchComment(commentId: string): Promise<CommentResource> {
    const { data } = await firstValueFrom(
      this.httpService.get<CommentResource>(`${this.cmsApiUrl}/api/comments/${commentId}`)
    )

    return data
  }

  private canEditArticle(user: AuthenticatedUser, authorId: string) {
    if (user.role === 'admin') {
      return true
    }

    if (user.role === 'writer') {
      return user.userId === authorId
    }

    return false
  }

  private canEditComment(user: AuthenticatedUser, ownerId: string) {
    if (user.role === 'admin') {
      return true
    }

    return user.userId === ownerId
  }
}
