import {
  Inject,
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common'
import { POSTGRES_CLIENT, type PostgresClient } from '../database/postgres.module'
import { TagsService } from '../tags/tags.service'
import {
  CreateArticleDto,
  UpdateArticleDto,
  ArticleQueryDto,
  type ArticleResponse,
  type ArticleListItem,
  type PaginationMeta,
} from './dto/article.dto'

interface ArticleRow {
  id: string
  title: string
  slug: string
  perex: string
  content: string
  cover_image_url: string | null
  author_id: string
  author_display_name: string
  author_avatar_url: string | null
  status: 'draft' | 'published' | 'archived'
  featured: boolean
  likes_count: number
  views_count: number
  published_at: Date | null
  created_at: Date
  updated_at: Date
}

@Injectable()
export class ArticlesService {
  constructor(
    @Inject(POSTGRES_CLIENT) private readonly db: PostgresClient,
    private readonly tagsService: TagsService
  ) {}

  /**
   * Create a URL-friendly slug from a title
   */
  private createSlug(title: string): string {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  /**
   * Get tags for an article
   */
  private async getTagsForArticle(articleId: string) {
    const result = await this.db.query(
      `SELECT t.* FROM tags t
       INNER JOIN article_tags at ON at.tag_id = t.id
       WHERE at.article_id = $1
       ORDER BY t.name`,
      [articleId]
    )
    return result.rows.map(row => ({
      id: row.id as string,
      name: row.name as string,
      slug: row.slug as string,
      description: row.description as string | null,
      createdAt: (row.created_at as Date).toISOString(),
      updatedAt: (row.updated_at as Date).toISOString(),
    }))
  }

  /**
   * Check if user has liked an article
   */
  private async hasUserLiked(articleId: string, userId?: string): Promise<boolean> {
    if (!userId) return false
    const result = await this.db.query(
      'SELECT 1 FROM likes WHERE article_id = $1 AND user_id = $2',
      [articleId, userId]
    )
    return result.rows.length > 0
  }

  /**
   * Map database row to response
   */
  private async mapToResponse(row: ArticleRow, userId?: string): Promise<ArticleResponse> {
    const tags = await this.getTagsForArticle(row.id)
    const isLiked = await this.hasUserLiked(row.id, userId)

    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      perex: row.perex,
      content: row.content,
      coverImageUrl: row.cover_image_url,
      author: {
        id: row.author_id,
        displayName: row.author_display_name,
        avatarUrl: row.author_avatar_url,
      },
      status: row.status,
      featured: row.featured,
      tags,
      likesCount: row.likes_count,
      viewsCount: row.views_count,
      isLiked,
      publishedAt: row.published_at?.toISOString() ?? null,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    }
  }

  /**
   * Map database row to list item (without content)
   */
  private async mapToListItem(row: ArticleRow, userId?: string): Promise<ArticleListItem> {
    const full = await this.mapToResponse(row, userId)
    const { content: _content, ...listItem } = full
    return listItem
  }

  /**
   * Get paginated list of articles
   */
  async findAll(
    query: ArticleQueryDto,
    userId?: string
  ): Promise<{ data: ArticleListItem[]; meta: PaginationMeta }> {
    const conditions: string[] = []
    const params: unknown[] = []
    let paramIndex = 1

    // Status filter
    if (query.status) {
      conditions.push(`a.status = $${paramIndex++}`)
      params.push(query.status)
    }

    // Author filter
    if (query.authorId) {
      conditions.push(`a.author_id = $${paramIndex++}`)
      params.push(query.authorId)
    }

    // Tags filter (comma-separated slugs)
    if (query.tags) {
      const tagSlugs = query.tags
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
      if (tagSlugs.length > 0) {
        conditions.push(`EXISTS (
          SELECT 1 FROM article_tags at
          INNER JOIN tags t ON t.id = at.tag_id
          WHERE at.article_id = a.id AND t.slug = ANY($${paramIndex++})
        )`)
        params.push(tagSlugs)
      }
    }

    // Search filter
    if (query.search) {
      conditions.push(`(a.title ILIKE $${paramIndex} OR a.perex ILIKE $${paramIndex})`)
      params.push(`%${query.search}%`)
      paramIndex++
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Get total count
    const countResult = await this.db.query(
      `SELECT COUNT(*) as total FROM articles a ${whereClause}`,
      params
    )
    const total = parseInt(countResult.rows[0].total as string, 10)

    // Sort mapping
    const sortColumn = {
      createdAt: 'a.created_at',
      publishedAt: 'a.published_at',
      likesCount: 'a.likes_count',
      viewsCount: 'a.views_count',
      title: 'a.title',
    }[query.sort]

    // Get paginated results
    const offset = (query.page - 1) * query.limit
    params.push(query.limit, offset)

    const result = await this.db.query(
      `SELECT 
        a.*,
        u.display_name as author_display_name,
        u.avatar_url as author_avatar_url
       FROM articles a
       INNER JOIN users u ON u.id = a.author_id
       ${whereClause}
       ORDER BY ${sortColumn} ${query.order.toUpperCase()}
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params
    )

    const totalPages = Math.ceil(total / query.limit)
    const data = await Promise.all(
      result.rows.map(row => this.mapToListItem(row as unknown as ArticleRow, userId))
    )

    return {
      data,
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
   * Get article by ID
   */
  async findById(id: string, userId?: string): Promise<ArticleResponse> {
    const result = await this.db.query(
      `SELECT 
        a.*,
        u.display_name as author_display_name,
        u.avatar_url as author_avatar_url
       FROM articles a
       INNER JOIN users u ON u.id = a.author_id
       WHERE a.id = $1`,
      [id]
    )

    if (result.rows.length === 0) {
      throw new NotFoundException(`Article with ID ${id} not found`)
    }

    return this.mapToResponse(result.rows[0] as unknown as ArticleRow, userId)
  }

  /**
   * Get article by slug
   */
  async findBySlug(slug: string, userId?: string): Promise<ArticleResponse> {
    const result = await this.db.query(
      `SELECT 
        a.*,
        u.display_name as author_display_name,
        u.avatar_url as author_avatar_url
       FROM articles a
       INNER JOIN users u ON u.id = a.author_id
       WHERE a.slug = $1`,
      [slug]
    )

    if (result.rows.length === 0) {
      throw new NotFoundException(`Article with slug ${slug} not found`)
    }

    return this.mapToResponse(result.rows[0] as unknown as ArticleRow, userId)
  }

  /**
   * Create a new article
   */
  async create(dto: CreateArticleDto, authorId: string): Promise<ArticleResponse> {
    const slug = dto.slug ?? this.createSlug(dto.title)

    // Check for slug conflict
    const existing = await this.db.query('SELECT id FROM articles WHERE slug = $1', [slug])
    if (existing.rows.length > 0) {
      throw new ConflictException(`An article with this slug already exists`)
    }

    // Set published_at if publishing
    const publishedAt = dto.status === 'published' ? new Date() : null

    const result = await this.db.query(
      `INSERT INTO articles (title, slug, perex, content, cover_image_url, author_id, status, featured, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        dto.title,
        slug,
        dto.perex,
        dto.content,
        dto.coverImageUrl ?? null,
        authorId,
        dto.status,
        dto.featured,
        publishedAt,
      ]
    )

    const articleId = result.rows[0].id as string

    // Handle tags
    if (dto.tags.length) {
      const tags = await this.tagsService.getOrCreateByNames(dto.tags)
      for (const tag of tags) {
        await this.db.query('INSERT INTO article_tags (article_id, tag_id) VALUES ($1, $2)', [
          articleId,
          tag.id,
        ])
      }
    }

    return this.findById(articleId, authorId)
  }

  /**
   * Update an article
   */
  async update(id: string, dto: UpdateArticleDto, userId: string): Promise<ArticleResponse> {
    // Check if article exists and user is author
    const existing = await this.db.query('SELECT author_id, status FROM articles WHERE id = $1', [
      id,
    ])
    if (existing.rows.length === 0) {
      throw new NotFoundException(`Article with ID ${id} not found`)
    }

    if (existing.rows[0].author_id !== userId) {
      throw new ForbiddenException('You can only edit your own articles')
    }

    const updates: string[] = []
    const values: unknown[] = []
    let paramIndex = 1

    if (dto.title !== undefined) {
      updates.push(`title = $${paramIndex++}`)
      values.push(dto.title)
    }

    if (dto.slug !== undefined) {
      // Check for slug conflict
      const conflict = await this.db.query('SELECT id FROM articles WHERE slug = $1 AND id != $2', [
        dto.slug,
        id,
      ])
      if (conflict.rows.length > 0) {
        throw new ConflictException(`An article with this slug already exists`)
      }
      updates.push(`slug = $${paramIndex++}`)
      values.push(dto.slug)
    }

    if (dto.perex !== undefined) {
      updates.push(`perex = $${paramIndex++}`)
      values.push(dto.perex)
    }

    if (dto.content !== undefined) {
      updates.push(`content = $${paramIndex++}`)
      values.push(dto.content)
    }

    if (dto.coverImageUrl !== undefined) {
      updates.push(`cover_image_url = $${paramIndex++}`)
      values.push(dto.coverImageUrl)
    }

    if (dto.status !== undefined) {
      updates.push(`status = $${paramIndex++}`)
      values.push(dto.status)

      // Set published_at if publishing for first time
      if (dto.status === 'published' && existing.rows[0].status !== 'published') {
        updates.push(`published_at = $${paramIndex++}`)
        values.push(new Date())
      }
    }

    if (dto.featured !== undefined) {
      updates.push(`featured = $${paramIndex++}`)
      values.push(dto.featured)
    }

    if (updates.length > 0) {
      values.push(id)
      await this.db.query(
        `UPDATE articles SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
        values
      )
    }

    // Handle tags update
    if (dto.tags !== undefined) {
      // Remove existing tags
      await this.db.query('DELETE FROM article_tags WHERE article_id = $1', [id])

      // Add new tags
      if (dto.tags.length > 0) {
        const tags = await this.tagsService.getOrCreateByNames(dto.tags)
        for (const tag of tags) {
          await this.db.query('INSERT INTO article_tags (article_id, tag_id) VALUES ($1, $2)', [
            id,
            tag.id,
          ])
        }
      }
    }

    return this.findById(id, userId)
  }

  /**
   * Delete an article
   */
  async delete(id: string, userId: string): Promise<void> {
    const existing = await this.db.query('SELECT author_id FROM articles WHERE id = $1', [id])
    if (existing.rows.length === 0) {
      throw new NotFoundException(`Article with ID ${id} not found`)
    }

    if (existing.rows[0].author_id !== userId) {
      throw new ForbiddenException('You can only delete your own articles')
    }

    await this.db.query('DELETE FROM articles WHERE id = $1', [id])
  }

  /**
   * Increment view count
   */
  async incrementViews(id: string): Promise<void> {
    await this.db.query('UPDATE articles SET views_count = views_count + 1 WHERE id = $1', [id])
  }
}
