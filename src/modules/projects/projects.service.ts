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
  CreateProjectDto,
  UpdateProjectDto,
  ProjectQueryDto,
  type ProjectResponse,
  type ProjectListItem,
  type PaginationMeta,
} from './dto/project.dto'

interface ProjectRow {
  id: string
  title: string
  slug: string
  type: 'game' | 'engine' | 'tool' | 'animation' | 'artwork' | 'other'
  description: string
  short_description: string | null
  cover_image_url: string | null
  gallery_urls: string[] | null
  github_url: string | null
  itchio_url: string | null
  steam_url: string | null
  youtube_url: string | null
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
export class ProjectsService {
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
   * Get tags for a project
   */
  private async getTagsForProject(projectId: string) {
    const result = await this.db.query(
      `SELECT t.* FROM tags t
       INNER JOIN project_tags pt ON pt.tag_id = t.id
       WHERE pt.project_id = $1
       ORDER BY t.name`,
      [projectId]
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
   * Check if user has liked a project
   */
  private async hasUserLiked(projectId: string, userId?: string): Promise<boolean> {
    if (!userId) return false
    const result = await this.db.query(
      'SELECT 1 FROM likes WHERE project_id = $1 AND user_id = $2',
      [projectId, userId]
    )
    return result.rows.length > 0
  }

  /**
   * Map database row to response
   */
  private async mapToResponse(row: ProjectRow, userId?: string): Promise<ProjectResponse> {
    const tags = await this.getTagsForProject(row.id)
    const isLiked = await this.hasUserLiked(row.id, userId)

    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      type: row.type,
      description: row.description,
      shortDescription: row.short_description,
      coverImageUrl: row.cover_image_url,
      galleryUrls: row.gallery_urls ?? [],
      githubUrl: row.github_url,
      itchioUrl: row.itchio_url,
      steamUrl: row.steam_url,
      youtubeUrl: row.youtube_url,
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
   * Map database row to list item (without description)
   */
  private async mapToListItem(row: ProjectRow, userId?: string): Promise<ProjectListItem> {
    const full = await this.mapToResponse(row, userId)
    const { description: _description, ...listItem } = full
    return listItem
  }

  /**
   * Get paginated list of projects
   */
  async findAll(
    query: ProjectQueryDto,
    userId?: string
  ): Promise<{ data: ProjectListItem[]; meta: PaginationMeta }> {
    const conditions: string[] = []
    const params: unknown[] = []
    let paramIndex = 1

    // Status filter
    if (query.status) {
      conditions.push(`p.status = $${paramIndex++}`)
      params.push(query.status)
    }

    // Type filter
    if (query.type) {
      conditions.push(`p.type = $${paramIndex++}`)
      params.push(query.type)
    }

    // Author filter
    if (query.authorId) {
      conditions.push(`p.author_id = $${paramIndex++}`)
      params.push(query.authorId)
    }

    // Featured filter
    if (query.featured !== undefined) {
      conditions.push(`p.featured = $${paramIndex++}`)
      params.push(query.featured)
    }

    // Tags filter (comma-separated slugs)
    if (query.tags) {
      const tagSlugs = query.tags
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
      if (tagSlugs.length > 0) {
        conditions.push(`EXISTS (
          SELECT 1 FROM project_tags pt
          INNER JOIN tags t ON t.id = pt.tag_id
          WHERE pt.project_id = p.id AND t.slug = ANY($${paramIndex++})
        )`)
        params.push(tagSlugs)
      }
    }

    // Search filter
    if (query.search) {
      conditions.push(`(p.title ILIKE $${paramIndex} OR p.short_description ILIKE $${paramIndex})`)
      params.push(`%${query.search}%`)
      paramIndex++
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Get total count
    const countResult = await this.db.query(
      `SELECT COUNT(*) as total FROM projects p ${whereClause}`,
      params
    )
    const total = parseInt(countResult.rows[0].total as string, 10)

    // Sort mapping
    const sortColumn = {
      createdAt: 'p.created_at',
      publishedAt: 'p.published_at',
      likesCount: 'p.likes_count',
      viewsCount: 'p.views_count',
      title: 'p.title',
    }[query.sort]

    // Get paginated results
    const offset = (query.page - 1) * query.limit
    params.push(query.limit, offset)

    const result = await this.db.query(
      `SELECT 
        p.*,
        u.display_name as author_display_name,
        u.avatar_url as author_avatar_url
       FROM projects p
       INNER JOIN users u ON u.id = p.author_id
       ${whereClause}
       ORDER BY ${sortColumn} ${query.order.toUpperCase()}
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params
    )

    const totalPages = Math.ceil(total / query.limit)
    const data = await Promise.all(
      result.rows.map(row => this.mapToListItem(row as unknown as ProjectRow, userId))
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
   * Get project by ID
   */
  async findById(id: string, userId?: string): Promise<ProjectResponse> {
    const result = await this.db.query(
      `SELECT 
        p.*,
        u.display_name as author_display_name,
        u.avatar_url as author_avatar_url
       FROM projects p
       INNER JOIN users u ON u.id = p.author_id
       WHERE p.id = $1`,
      [id]
    )

    if (result.rows.length === 0) {
      throw new NotFoundException(`Project with ID ${id} not found`)
    }

    return this.mapToResponse(result.rows[0] as unknown as ProjectRow, userId)
  }

  /**
   * Get project by slug
   */
  async findBySlug(slug: string, userId?: string): Promise<ProjectResponse> {
    const result = await this.db.query(
      `SELECT 
        p.*,
        u.display_name as author_display_name,
        u.avatar_url as author_avatar_url
       FROM projects p
       INNER JOIN users u ON u.id = p.author_id
       WHERE p.slug = $1`,
      [slug]
    )

    if (result.rows.length === 0) {
      throw new NotFoundException(`Project with slug ${slug} not found`)
    }

    return this.mapToResponse(result.rows[0] as unknown as ProjectRow, userId)
  }

  /**
   * Create a new project
   */
  async create(dto: CreateProjectDto, authorId: string): Promise<ProjectResponse> {
    const slug = dto.slug ?? this.createSlug(dto.title)

    // Check for slug conflict
    const existing = await this.db.query('SELECT id FROM projects WHERE slug = $1', [slug])
    if (existing.rows.length > 0) {
      throw new ConflictException(`A project with this slug already exists`)
    }

    // Set published_at if publishing
    const publishedAt = dto.status === 'published' ? new Date() : null

    const result = await this.db.query(
      `INSERT INTO projects (title, slug, type, description, short_description, cover_image_url, gallery_urls, github_url, itchio_url, steam_url, youtube_url, author_id, status, featured, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        dto.title,
        slug,
        dto.type,
        dto.description,
        dto.shortDescription ?? null,
        dto.coverImageUrl ?? null,
        dto.galleryUrls,
        dto.githubUrl ?? null,
        dto.itchioUrl ?? null,
        dto.steamUrl ?? null,
        dto.youtubeUrl ?? null,
        authorId,
        dto.status,
        dto.featured,
        publishedAt,
      ]
    )

    const projectId = result.rows[0].id as string

    // Handle tags
    if (dto.tags.length) {
      const tags = await this.tagsService.getOrCreateByNames(dto.tags)
      for (const tag of tags) {
        await this.db.query('INSERT INTO project_tags (project_id, tag_id) VALUES ($1, $2)', [
          projectId,
          tag.id,
        ])
      }
    }

    return this.findById(projectId, authorId)
  }

  /**
   * Update a project
   */
  async update(id: string, dto: UpdateProjectDto, userId: string): Promise<ProjectResponse> {
    // Check if project exists and user is author
    const existing = await this.db.query('SELECT author_id, status FROM projects WHERE id = $1', [
      id,
    ])
    if (existing.rows.length === 0) {
      throw new NotFoundException(`Project with ID ${id} not found`)
    }

    if (existing.rows[0].author_id !== userId) {
      throw new ForbiddenException('You can only edit your own projects')
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
      const conflict = await this.db.query('SELECT id FROM projects WHERE slug = $1 AND id != $2', [
        dto.slug,
        id,
      ])
      if (conflict.rows.length > 0) {
        throw new ConflictException(`A project with this slug already exists`)
      }
      updates.push(`slug = $${paramIndex++}`)
      values.push(dto.slug)
    }

    if (dto.type !== undefined) {
      updates.push(`type = $${paramIndex++}`)
      values.push(dto.type)
    }

    if (dto.description !== undefined) {
      updates.push(`description = $${paramIndex++}`)
      values.push(dto.description)
    }

    if (dto.shortDescription !== undefined) {
      updates.push(`short_description = $${paramIndex++}`)
      values.push(dto.shortDescription)
    }

    if (dto.coverImageUrl !== undefined) {
      updates.push(`cover_image_url = $${paramIndex++}`)
      values.push(dto.coverImageUrl)
    }

    if (dto.galleryUrls !== undefined) {
      updates.push(`gallery_urls = $${paramIndex++}`)
      values.push(dto.galleryUrls)
    }

    if (dto.githubUrl !== undefined) {
      updates.push(`github_url = $${paramIndex++}`)
      values.push(dto.githubUrl)
    }

    if (dto.itchioUrl !== undefined) {
      updates.push(`itchio_url = $${paramIndex++}`)
      values.push(dto.itchioUrl)
    }

    if (dto.steamUrl !== undefined) {
      updates.push(`steam_url = $${paramIndex++}`)
      values.push(dto.steamUrl)
    }

    if (dto.youtubeUrl !== undefined) {
      updates.push(`youtube_url = $${paramIndex++}`)
      values.push(dto.youtubeUrl)
    }

    if (dto.featured !== undefined) {
      updates.push(`featured = $${paramIndex++}`)
      values.push(dto.featured)
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

    if (updates.length > 0) {
      values.push(id)
      await this.db.query(
        `UPDATE projects SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
        values
      )
    }

    // Handle tags update
    if (dto.tags !== undefined) {
      // Remove existing tags
      await this.db.query('DELETE FROM project_tags WHERE project_id = $1', [id])

      // Add new tags
      if (dto.tags.length > 0) {
        const tags = await this.tagsService.getOrCreateByNames(dto.tags)
        for (const tag of tags) {
          await this.db.query('INSERT INTO project_tags (project_id, tag_id) VALUES ($1, $2)', [
            id,
            tag.id,
          ])
        }
      }
    }

    return this.findById(id, userId)
  }

  /**
   * Delete a project
   */
  async delete(id: string, userId: string): Promise<void> {
    const existing = await this.db.query('SELECT author_id FROM projects WHERE id = $1', [id])
    if (existing.rows.length === 0) {
      throw new NotFoundException(`Project with ID ${id} not found`)
    }

    if (existing.rows[0].author_id !== userId) {
      throw new ForbiddenException('You can only delete your own projects')
    }

    await this.db.query('DELETE FROM projects WHERE id = $1', [id])
  }

  /**
   * Increment view count
   */
  async incrementViews(id: string): Promise<void> {
    await this.db.query('UPDATE projects SET views_count = views_count + 1 WHERE id = $1', [id])
  }
}
