import { Inject, Injectable, NotFoundException, ConflictException } from '@nestjs/common'
import { POSTGRES_CLIENT, type PostgresClient } from '../database/postgres.module'
import { type LikeTargetDto, type LikeStatus } from './dto/like.dto'

@Injectable()
export class LikesService {
  constructor(@Inject(POSTGRES_CLIENT) private readonly db: PostgresClient) {}

  /**
   * Like an article
   */
  async likeArticle(articleId: string, userId: string): Promise<LikeStatus> {
    // Check if article exists
    const article = await this.db.query('SELECT id, likes_count FROM articles WHERE id = $1', [
      articleId,
    ])
    if (article.rows.length === 0) {
      throw new NotFoundException('Article not found')
    }

    // Check if already liked
    const existing = await this.db.query(
      'SELECT id FROM likes WHERE article_id = $1 AND user_id = $2',
      [articleId, userId]
    )
    if (existing.rows.length > 0) {
      throw new ConflictException('Article already liked')
    }

    // Create like
    await this.db.query('INSERT INTO likes (user_id, article_id) VALUES ($1, $2)', [
      userId,
      articleId,
    ])

    // Get updated count (trigger updates it, but re-fetch to be sure)
    const updated = await this.db.query('SELECT likes_count FROM articles WHERE id = $1', [
      articleId,
    ])

    return {
      isLiked: true,
      likesCount: updated.rows[0].likes_count as number,
    }
  }

  /**
   * Unlike an article
   */
  async unlikeArticle(articleId: string, userId: string): Promise<LikeStatus> {
    // Check if article exists
    const article = await this.db.query('SELECT id FROM articles WHERE id = $1', [articleId])
    if (article.rows.length === 0) {
      throw new NotFoundException('Article not found')
    }

    // Delete like
    const result = await this.db.query(
      'DELETE FROM likes WHERE article_id = $1 AND user_id = $2 RETURNING id',
      [articleId, userId]
    )
    if (result.rows.length === 0) {
      throw new NotFoundException('Like not found')
    }

    // Get updated count
    const updated = await this.db.query('SELECT likes_count FROM articles WHERE id = $1', [
      articleId,
    ])

    return {
      isLiked: false,
      likesCount: updated.rows[0].likes_count as number,
    }
  }

  /**
   * Like a project
   */
  async likeProject(projectId: string, userId: string): Promise<LikeStatus> {
    // Check if project exists
    const project = await this.db.query('SELECT id, likes_count FROM projects WHERE id = $1', [
      projectId,
    ])
    if (project.rows.length === 0) {
      throw new NotFoundException('Project not found')
    }

    // Check if already liked
    const existing = await this.db.query(
      'SELECT id FROM likes WHERE project_id = $1 AND user_id = $2',
      [projectId, userId]
    )
    if (existing.rows.length > 0) {
      throw new ConflictException('Project already liked')
    }

    // Create like
    await this.db.query('INSERT INTO likes (user_id, project_id) VALUES ($1, $2)', [
      userId,
      projectId,
    ])

    // Get updated count
    const updated = await this.db.query('SELECT likes_count FROM projects WHERE id = $1', [
      projectId,
    ])

    return {
      isLiked: true,
      likesCount: updated.rows[0].likes_count as number,
    }
  }

  /**
   * Unlike a project
   */
  async unlikeProject(projectId: string, userId: string): Promise<LikeStatus> {
    // Check if project exists
    const project = await this.db.query('SELECT id FROM projects WHERE id = $1', [projectId])
    if (project.rows.length === 0) {
      throw new NotFoundException('Project not found')
    }

    // Delete like
    const result = await this.db.query(
      'DELETE FROM likes WHERE project_id = $1 AND user_id = $2 RETURNING id',
      [projectId, userId]
    )
    if (result.rows.length === 0) {
      throw new NotFoundException('Like not found')
    }

    // Get updated count
    const updated = await this.db.query('SELECT likes_count FROM projects WHERE id = $1', [
      projectId,
    ])

    return {
      isLiked: false,
      likesCount: updated.rows[0].likes_count as number,
    }
  }

  /**
   * Like a comment
   */
  async likeComment(commentId: string, userId: string): Promise<LikeStatus> {
    // Check if comment exists
    const comment = await this.db.query('SELECT id, likes_count FROM comments WHERE id = $1', [
      commentId,
    ])
    if (comment.rows.length === 0) {
      throw new NotFoundException('Comment not found')
    }

    // Check if already liked
    const existing = await this.db.query(
      'SELECT id FROM likes WHERE comment_id = $1 AND user_id = $2',
      [commentId, userId]
    )
    if (existing.rows.length > 0) {
      throw new ConflictException('Comment already liked')
    }

    // Create like
    await this.db.query('INSERT INTO likes (user_id, comment_id) VALUES ($1, $2)', [
      userId,
      commentId,
    ])

    // Get updated count
    const updated = await this.db.query('SELECT likes_count FROM comments WHERE id = $1', [
      commentId,
    ])

    return {
      isLiked: true,
      likesCount: updated.rows[0].likes_count as number,
    }
  }

  /**
   * Unlike a comment
   */
  async unlikeComment(commentId: string, userId: string): Promise<LikeStatus> {
    // Check if comment exists
    const comment = await this.db.query('SELECT id FROM comments WHERE id = $1', [commentId])
    if (comment.rows.length === 0) {
      throw new NotFoundException('Comment not found')
    }

    // Delete like
    const result = await this.db.query(
      'DELETE FROM likes WHERE comment_id = $1 AND user_id = $2 RETURNING id',
      [commentId, userId]
    )
    if (result.rows.length === 0) {
      throw new NotFoundException('Like not found')
    }

    // Get updated count
    const updated = await this.db.query('SELECT likes_count FROM comments WHERE id = $1', [
      commentId,
    ])

    return {
      isLiked: false,
      likesCount: updated.rows[0].likes_count as number,
    }
  }

  /**
   * Get like status for a target
   */
  async getLikeStatus(target: LikeTargetDto, userId?: string): Promise<LikeStatus> {
    let likesCount = 0
    let isLiked = false

    if (target.articleId) {
      const article = await this.db.query('SELECT likes_count FROM articles WHERE id = $1', [
        target.articleId,
      ])
      if (article.rows.length === 0) {
        throw new NotFoundException('Article not found')
      }
      likesCount = article.rows[0].likes_count as number

      if (userId) {
        const like = await this.db.query(
          'SELECT 1 FROM likes WHERE article_id = $1 AND user_id = $2',
          [target.articleId, userId]
        )
        isLiked = like.rows.length > 0
      }
    } else if (target.projectId) {
      const project = await this.db.query('SELECT likes_count FROM projects WHERE id = $1', [
        target.projectId,
      ])
      if (project.rows.length === 0) {
        throw new NotFoundException('Project not found')
      }
      likesCount = project.rows[0].likes_count as number

      if (userId) {
        const like = await this.db.query(
          'SELECT 1 FROM likes WHERE project_id = $1 AND user_id = $2',
          [target.projectId, userId]
        )
        isLiked = like.rows.length > 0
      }
    } else if (target.commentId) {
      const comment = await this.db.query('SELECT likes_count FROM comments WHERE id = $1', [
        target.commentId,
      ])
      if (comment.rows.length === 0) {
        throw new NotFoundException('Comment not found')
      }
      likesCount = comment.rows[0].likes_count as number

      if (userId) {
        const like = await this.db.query(
          'SELECT 1 FROM likes WHERE comment_id = $1 AND user_id = $2',
          [target.commentId, userId]
        )
        isLiked = like.rows.length > 0
      }
    }

    return { isLiked, likesCount }
  }
}
