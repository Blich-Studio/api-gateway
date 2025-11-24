import type { AuthenticatedUser } from '../../auth/auth.types'
import type { UpdateArticleDto } from '../dto/update-article.dto'
import type { UpdateCommentDto } from '../dto/update-comment.dto'

export interface EditorialServiceContract {
  updateArticle(
    articleId: string,
    payload: UpdateArticleDto,
    user: AuthenticatedUser
  ): Promise<unknown>
  updateComment(
    commentId: string,
    payload: UpdateCommentDto,
    user: AuthenticatedUser
  ): Promise<unknown>
  deleteTag(tagId: string, user: AuthenticatedUser): Promise<unknown>
  createTag(payload: Record<string, unknown>, user: AuthenticatedUser): Promise<unknown>
}

export const EDITORIAL_SERVICE = Symbol('EDITORIAL_SERVICE')
