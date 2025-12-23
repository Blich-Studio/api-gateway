import { Inject, Injectable, ConflictException, NotFoundException } from '@nestjs/common'
import { POSTGRES_CLIENT, type PostgresClient } from '../database/postgres.module'
import { CreateTagDto, UpdateTagDto, type TagResponse } from './dto/tag.dto'

@Injectable()
export class TagsService {
  constructor(@Inject(POSTGRES_CLIENT) private readonly db: PostgresClient) {}

  /**
   * Create a URL-friendly slug from a name
   */
  private createSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  /**
   * Map database row to response DTO
   */
  private mapToResponse(row: Record<string, unknown>): TagResponse {
    return {
      id: row.id as string,
      name: row.name as string,
      slug: row.slug as string,
      description: row.description as string | null,
      createdAt: (row.created_at as Date).toISOString(),
      updatedAt: (row.updated_at as Date).toISOString(),
    }
  }

  /**
   * Get all tags
   */
  async findAll(search?: string): Promise<TagResponse[]> {
    let query = 'SELECT * FROM tags'
    const params: unknown[] = []

    if (search) {
      query += ' WHERE name ILIKE $1 OR description ILIKE $1'
      params.push(`%${search}%`)
    }

    query += ' ORDER BY name ASC'

    const result = await this.db.query(query, params)
    return result.rows.map(row => this.mapToResponse(row))
  }

  /**
   * Get a tag by ID
   */
  async findById(id: string): Promise<TagResponse> {
    const result = await this.db.query('SELECT * FROM tags WHERE id = $1', [id])

    if (result.rows.length === 0) {
      throw new NotFoundException(`Tag with ID ${id} not found`)
    }

    return this.mapToResponse(result.rows[0])
  }

  /**
   * Get a tag by slug
   */
  async findBySlug(slug: string): Promise<TagResponse> {
    const result = await this.db.query('SELECT * FROM tags WHERE slug = $1', [slug])

    if (result.rows.length === 0) {
      throw new NotFoundException(`Tag with slug ${slug} not found`)
    }

    return this.mapToResponse(result.rows[0])
  }

  /**
   * Create a new tag
   */
  async create(dto: CreateTagDto): Promise<TagResponse> {
    const slug = this.createSlug(dto.name)

    // Check if tag with same name or slug exists
    const existing = await this.db.query('SELECT id FROM tags WHERE name = $1 OR slug = $2', [
      dto.name,
      slug,
    ])

    if (existing.rows.length > 0) {
      throw new ConflictException(`A tag with this name already exists`)
    }

    const result = await this.db.query(
      `INSERT INTO tags (name, slug, description)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [dto.name, slug, dto.description ?? null]
    )

    return this.mapToResponse(result.rows[0])
  }

  /**
   * Update a tag
   */
  async update(id: string, dto: UpdateTagDto): Promise<TagResponse> {
    // Check if tag exists
    const existing = await this.db.query('SELECT * FROM tags WHERE id = $1', [id])
    if (existing.rows.length === 0) {
      throw new NotFoundException(`Tag with ID ${id} not found`)
    }

    const updates: string[] = []
    const values: unknown[] = []
    let paramIndex = 1

    if (dto.name !== undefined) {
      const newSlug = this.createSlug(dto.name)

      // Check if new name/slug conflicts with another tag
      const conflict = await this.db.query(
        'SELECT id FROM tags WHERE (name = $1 OR slug = $2) AND id != $3',
        [dto.name, newSlug, id]
      )
      if (conflict.rows.length > 0) {
        throw new ConflictException(`A tag with this name already exists`)
      }

      updates.push(`name = $${paramIndex++}`)
      values.push(dto.name)
      updates.push(`slug = $${paramIndex++}`)
      values.push(newSlug)
    }

    if (dto.description !== undefined) {
      updates.push(`description = $${paramIndex++}`)
      values.push(dto.description)
    }

    if (updates.length === 0) {
      return this.mapToResponse(existing.rows[0])
    }

    values.push(id)
    const result = await this.db.query(
      `UPDATE tags SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    )

    return this.mapToResponse(result.rows[0])
  }

  /**
   * Delete a tag
   */
  async delete(id: string): Promise<void> {
    const result = await this.db.query('DELETE FROM tags WHERE id = $1 RETURNING id', [id])

    if (result.rows.length === 0) {
      throw new NotFoundException(`Tag with ID ${id} not found`)
    }
  }

  /**
   * Get or create tags by names (for article/project creation)
   */
  async getOrCreateByNames(names: string[]): Promise<TagResponse[]> {
    if (names.length === 0) return []

    const tags: TagResponse[] = []

    for (const name of names) {
      const slug = this.createSlug(name)

      // Try to find existing tag
      let result = await this.db.query('SELECT * FROM tags WHERE slug = $1', [slug])

      if (result.rows.length === 0) {
        // Create new tag
        result = await this.db.query(`INSERT INTO tags (name, slug) VALUES ($1, $2) RETURNING *`, [
          name,
          slug,
        ])
      }

      tags.push(this.mapToResponse(result.rows[0]))
    }

    return tags
  }
}
