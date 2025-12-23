import {
  Inject,
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common'
import { POSTGRES_CLIENT, type PostgresClient } from '../database/postgres.module'
import {
  CreateCommentDto,
  UpdateCommentDto,
  CommentQueryDto,
  type CommentResponse,
  type PaginationMeta,
} from './dto/comment.dto'

interface CommentRow {
  id: string
  content: string
  user_id: string
  user_display_name: string
  user_avatar_url: string | null
  article_id: string | null
  project_id: string | null
  parent_id: string | null
  status: 'pending' | 'approved' | 'rejected' | 'spam'
  likes_count: number
  created_at: Date
  updated_at: Date
}

@Injectable()
export class CommentsService {
  constructor(@Inject(POSTGRES_CLIENT) private readonly db: PostgresClient) {}

  /**
   * Check if user has liked a comment
   */
  private async hasUserLiked(commentId: string, userId?: string): Promise<boolean> {
    if (!userId) return false
    const result = await this.db.query(
      'SELECT 1 FROM likes WHERE comment_id = $1 AND user_id = $2',
      [commentId, userId]
    )
    return result.rows.length > 0
  }

  /**
   * Map database row to response
   */
  private async mapToResponse(row: CommentRow, userId?: string): Promise<CommentResponse> {
    const isLiked = await this.hasUserLiked(row.id, userId)

    return {
      id: row.id,
      content: row.content,
      user: {
        id: row.user_id,
        displayName: row.user_display_name,
        avatarUrl: row.user_avatar_url,
      },
      userId: row.user_id,
      articleId: row.article_id,
      projectId: row.project_id,
      parentId: row.parent_id,
      status: row.status,
      likesCount: row.likes_count,
      isLiked,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    }
  }

  /**
   * Get replies for a comment
   */
  private async getReplies(parentId: string, userId?: string): Promise<CommentResponse[]> {
    const result = await this.db.query(
      `SELECT 
        c.*,
        u.display_name as user_display_name,
        u.avatar_url as user_avatar_url
       FROM comments c
       INNER JOIN users u ON u.id = c.user_id
       WHERE c.parent_id = $1 AND c.status = 'approved'
       ORDER BY c.created_at ASC`,
      [parentId]
    )

    return Promise.all(
      result.rows.map(row => this.mapToResponse(row as unknown as CommentRow, userId))
    )
  }

  /**
   * Get paginated list of comments
   */
  async findAll(
    query: CommentQueryDto,
    userId?: string
  ): Promise<{ data: CommentResponse[]; meta: PaginationMeta }> {
    const conditions: string[] = ['c.parent_id IS NULL'] // Only top-level comments
    const params: unknown[] = []
    let paramIndex = 1

    // Article filter
    if (query.articleId) {
      conditions.push(`c.article_id = $${paramIndex++}`)
      params.push(query.articleId)
    }

    // Project filter
    if (query.projectId) {
      conditions.push(`c.project_id = $${paramIndex++}`)
      params.push(query.projectId)
    }

    // Status filter (default to approved for public)
    if (query.status) {
      conditions.push(`c.status = $${paramIndex++}`)
      params.push(query.status)
    } else {
      conditions.push(`c.status = 'approved'`)
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`

    // Get total count
    const countResult = await this.db.query(
      `SELECT COUNT(*) as total FROM comments c ${whereClause}`,
      params
    )
    const total = parseInt(countResult.rows[0].total as string, 10)

    // Get paginated results
    const offset = (query.page - 1) * query.limit
    params.push(query.limit, offset)

    const result = await this.db.query(
      `SELECT 
        c.*,
        u.display_name as user_display_name,
        u.avatar_url as user_avatar_url
       FROM comments c
       INNER JOIN users u ON u.id = c.user_id
       ${whereClause}
       ORDER BY c.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params
    )

    const totalPages = Math.ceil(total / query.limit)
    const comments = await Promise.all(
      result.rows.map(async row => {
        const comment = await this.mapToResponse(row as unknown as CommentRow, userId)
        // Fetch replies for each top-level comment
        comment.replies = await this.getReplies(comment.id, userId)
        return comment
      })
    )

    return {
      data: comments,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
        hasNext: query.page < totalPages,
        hasPrev: query.page > 1,
      },
    }
  }

  /**
   * Get comment by ID
   */
  async findById(id: string, userId?: string): Promise<CommentResponse> {
    const result = await this.db.query(
      `SELECT 
        c.*,
        u.display_name as user_display_name,
        u.avatar_url as user_avatar_url
       FROM comments c
       INNER JOIN users u ON u.id = c.user_id
       WHERE c.id = $1`,
      [id]
    )

    if (result.rows.length === 0) {
      throw new NotFoundException(`Comment with ID ${id} not found`)
    }

    const comment = await this.mapToResponse(result.rows[0] as unknown as CommentRow, userId)
    comment.replies = await this.getReplies(comment.id, userId)
    return comment
  }

  /**
   * Create a new comment
   */
  async create(dto: CreateCommentDto, userId: string): Promise<CommentResponse> {
    // Validate parent comment if provided
    if (dto.parentId) {
      const parent = await this.db.query(
        'SELECT article_id, project_id FROM comments WHERE id = $1',
        [dto.parentId]
      )
      if (parent.rows.length === 0) {
        throw new BadRequestException('Parent comment not found')
      }
      // Ensure reply is for the same article/project as parent
      if (dto.articleId && parent.rows[0].article_id !== dto.articleId) {
        throw new BadRequestException('Reply must be for the same article as parent comment')
      }
      if (dto.projectId && parent.rows[0].project_id !== dto.projectId) {
        throw new BadRequestException('Reply must be for the same project as parent comment')
      }
    }

    // Validate article exists if provided
    if (dto.articleId) {
      const article = await this.db.query('SELECT id FROM articles WHERE id = $1', [dto.articleId])
      if (article.rows.length === 0) {
        throw new BadRequestException('Article not found')
      }
    }

    // Validate project exists if provided
    if (dto.projectId) {
      const project = await this.db.query('SELECT id FROM projects WHERE id = $1', [dto.projectId])
      if (project.rows.length === 0) {
        throw new BadRequestException('Project not found')
      }
    }

    const result = await this.db.query(
      `INSERT INTO comments (content, user_id, article_id, project_id, parent_id, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        dto.content,
        userId,
        dto.articleId ?? null,
        dto.projectId ?? null,
        dto.parentId ?? null,
        'approved',
      ] // Auto-approve for now
    )

    return this.findById(result.rows[0].id as string, userId)
  }

  /**
   * Update a comment
   */
  async update(
    id: string,
    dto: UpdateCommentDto,
    userId: string,
    isAdmin = false
  ): Promise<CommentResponse> {
    const existing = await this.db.query('SELECT user_id FROM comments WHERE id = $1', [id])
    if (existing.rows.length === 0) {
      throw new NotFoundException(`Comment with ID ${id} not found`)
    }

    // Only author can edit content, only admin can change status
    if (dto.content !== undefined && existing.rows[0].user_id !== userId) {
      throw new ForbiddenException('You can only edit your own comments')
    }

    if (dto.status !== undefined && !isAdmin) {
      throw new ForbiddenException('Only admins can change comment status')
    }

    const updates: string[] = []
    const values: unknown[] = []
    let paramIndex = 1

    if (dto.content !== undefined) {
      updates.push(`content = $${paramIndex++}`)
      values.push(dto.content)
    }

    if (dto.status !== undefined) {
      updates.push(`status = $${paramIndex++}`)
      values.push(dto.status)
    }

    if (updates.length > 0) {
      values.push(id)
      await this.db.query(
        `UPDATE comments SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
        values
      )
    }

    return this.findById(id, userId)
  }

  /**
   * Delete a comment
   */
  async delete(id: string, userId: string, isAdmin = false): Promise<void> {
    const existing = await this.db.query('SELECT user_id FROM comments WHERE id = $1', [id])
    if (existing.rows.length === 0) {
      throw new NotFoundException(`Comment with ID ${id} not found`)
    }

    if (existing.rows[0].user_id !== userId && !isAdmin) {
      throw new ForbiddenException('You can only delete your own comments')
    }

    await this.db.query('DELETE FROM comments WHERE id = $1', [id])
  }
}
