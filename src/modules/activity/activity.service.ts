import { Inject, Injectable } from '@nestjs/common'
import { POSTGRES_CLIENT, type PostgresClient } from '../database/postgres.module'
import type {
  ActivityQuery,
  ActivityResponse,
  ActivityStats,
  ActivityType,
} from './dto/activity.dto'

interface ActivityRow {
  id: string
  type: ActivityType
  actor_id: string
  actor_name: string
  actor_avatar: string | null
  target_type: 'article' | 'project' | 'comment' | 'user' | null
  target_id: string | null
  target_title: string | null
  target_slug: string | null
  metadata: Record<string, unknown> | null
  created_at: Date
}

@Injectable()
export class ActivityService {
  constructor(@Inject(POSTGRES_CLIENT) private readonly db: PostgresClient) {}

  /**
   * Get recent activity feed
   */
  async getActivityFeed(query: ActivityQuery) {
    const { type, page, limit } = query
    const offset = (page - 1) * limit

    // Build a unified activity feed from multiple sources
    // This uses UNION ALL to combine different activity types
    const activities: ActivityResponse[] = []

    // Get recent comments
    const commentsQuery = `
      SELECT 
        c.id,
        'comment_created' as type,
        c.user_id as actor_id,
        u.nickname as actor_name,
        u.avatar_url as actor_avatar,
        CASE 
          WHEN c.article_id IS NOT NULL THEN 'article'
          WHEN c.project_id IS NOT NULL THEN 'project'
          ELSE NULL
        END as target_type,
        COALESCE(c.article_id, c.project_id)::text as target_id,
        COALESCE(a.title, p.title) as target_title,
        COALESCE(a.slug, p.slug) as target_slug,
        NULL as metadata,
        c.created_at
      FROM comments c
      JOIN users u ON c.user_id = u.id
      LEFT JOIN articles a ON c.article_id = a.id
      LEFT JOIN projects p ON c.project_id = p.id
      WHERE c.status != 'spam'
      ${type === 'comment_created' ? '' : ''}
    `

    // Get recent article publications
    const articlesQuery = `
      SELECT 
        a.id,
        CASE 
          WHEN a.status = 'published' THEN 'article_published'
          ELSE 'article_created'
        END as type,
        a.author_id as actor_id,
        u.nickname as actor_name,
        u.avatar_url as actor_avatar,
        'article' as target_type,
        a.id::text as target_id,
        a.title as target_title,
        a.slug as target_slug,
        NULL as metadata,
        CASE 
          WHEN a.published_at IS NOT NULL THEN a.published_at
          ELSE a.created_at
        END as created_at
      FROM articles a
      JOIN users u ON a.author_id = u.id
      ${type === 'article_published' ? "WHERE a.status = 'published'" : ''}
      ${type === 'article_created' ? "WHERE a.status = 'draft'" : ''}
    `

    // Get recent user registrations
    const usersQuery = `
      SELECT 
        u.id,
        'user_registered' as type,
        u.id as actor_id,
        u.nickname as actor_name,
        u.avatar_url as actor_avatar,
        'user' as target_type,
        u.id::text as target_id,
        u.nickname as target_title,
        NULL as target_slug,
        NULL as metadata,
        u.created_at
      FROM users u
      ${type === 'user_registered' ? '' : ''}
    `

    // Combine all activities and sort by date
    const combinedQuery = `
      WITH all_activities AS (
        ${type === 'comment_created' || !type ? commentsQuery : 'SELECT NULL::uuid as id, NULL::text as type, NULL::uuid as actor_id, NULL::text as actor_name, NULL::text as actor_avatar, NULL::text as target_type, NULL::text as target_id, NULL::text as target_title, NULL::text as target_slug, NULL::jsonb as metadata, NULL::timestamp as created_at WHERE FALSE'}
        UNION ALL
        ${type === 'article_published' || type === 'article_created' || !type ? articlesQuery : 'SELECT NULL::uuid as id, NULL::text as type, NULL::uuid as actor_id, NULL::text as actor_name, NULL::text as actor_avatar, NULL::text as target_type, NULL::text as target_id, NULL::text as target_title, NULL::text as target_slug, NULL::jsonb as metadata, NULL::timestamp as created_at WHERE FALSE'}
        UNION ALL
        ${type === 'user_registered' || !type ? usersQuery : 'SELECT NULL::uuid as id, NULL::text as type, NULL::uuid as actor_id, NULL::text as actor_name, NULL::text as actor_avatar, NULL::text as target_type, NULL::text as target_id, NULL::text as target_title, NULL::text as target_slug, NULL::jsonb as metadata, NULL::timestamp as created_at WHERE FALSE'}
      )
      SELECT * FROM all_activities
      WHERE id IS NOT NULL
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `

    const result = await this.db.query(combinedQuery, [limit, offset])

    for (const row of result.rows as unknown as ActivityRow[]) {
      activities.push(this.mapToResponse(row))
    }

    // Get total count
    const countQuery = `
      WITH all_activities AS (
        ${!type || type === 'comment_created' ? "SELECT id FROM comments WHERE status != 'spam'" : 'SELECT NULL::uuid as id WHERE FALSE'}
        UNION ALL
        ${!type || type === 'article_published' || type === 'article_created' ? 'SELECT id FROM articles' : 'SELECT NULL::uuid as id WHERE FALSE'}
        UNION ALL
        ${!type || type === 'user_registered' ? 'SELECT id FROM users' : 'SELECT NULL::uuid as id WHERE FALSE'}
      )
      SELECT COUNT(*) as total FROM all_activities WHERE id IS NOT NULL
    `
    const countResult = await this.db.query(countQuery)
    const total = Number(countResult.rows[0]?.total ?? 0)
    const totalPages = Math.ceil(total / limit)

    return {
      data: activities,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    }
  }

  /**
   * Get activity statistics for the dashboard
   */
  async getStats(): Promise<ActivityStats> {
    const statsQuery = `
      SELECT
        (SELECT COUNT(*) FROM comments WHERE status != 'spam') as total_comments,
        (SELECT COUNT(*) FROM comments WHERE status = 'pending') as pending_comments,
        (SELECT COUNT(*) FROM articles) as total_articles,
        (SELECT COUNT(*) FROM articles WHERE status = 'published') as published_articles,
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL '24 hours') as new_users_today,
        (SELECT COUNT(*) FROM likes) as total_likes
    `

    const result = await this.db.query(statsQuery)
    const row = result.rows[0] as Record<string, string | number>

    return {
      totalComments: Number(row.total_comments || 0),
      pendingComments: Number(row.pending_comments || 0),
      totalArticles: Number(row.total_articles || 0),
      publishedArticles: Number(row.published_articles || 0),
      totalUsers: Number(row.total_users || 0),
      newUsersToday: Number(row.new_users_today || 0),
      totalLikes: Number(row.total_likes || 0),
    }
  }

  /**
   * Get recent comments for moderation
   */
  async getRecentComments(limit = 10) {
    const query = `
      SELECT 
        c.id,
        c.content,
        c.status,
        c.created_at,
        u.id as user_id,
        u.nickname as user_name,
        u.avatar_url as user_avatar,
        COALESCE(a.title, p.title) as target_title,
        CASE 
          WHEN c.article_id IS NOT NULL THEN 'article'
          WHEN c.project_id IS NOT NULL THEN 'project'
          ELSE NULL
        END as target_type
      FROM comments c
      JOIN users u ON c.user_id = u.id
      LEFT JOIN articles a ON c.article_id = a.id
      LEFT JOIN projects p ON c.project_id = p.id
      ORDER BY c.created_at DESC
      LIMIT $1
    `

    const result = await this.db.query(query, [limit])

    return result.rows.map((row: Record<string, unknown>) => ({
      id: row.id,
      content: row.content,
      status: row.status,
      createdAt: (row.created_at as Date).toISOString(),
      user: {
        id: row.user_id,
        displayName: row.user_name,
        avatarUrl: row.user_avatar,
      },
      targetTitle: row.target_title,
      targetType: row.target_type,
    }))
  }

  private mapToResponse(row: ActivityRow): ActivityResponse {
    return {
      id: row.id,
      type: row.type,
      message: this.getActivityMessage(row),
      actor: {
        id: row.actor_id,
        displayName: row.actor_name,
        avatarUrl: row.actor_avatar,
      },
      target: row.target_type
        ? {
            type: row.target_type,
            id: row.target_id ?? '',
            title: row.target_title ?? undefined,
            slug: row.target_slug ?? undefined,
          }
        : undefined,
      metadata: row.metadata ?? undefined,
      createdAt: row.created_at.toISOString(),
    }
  }

  private getActivityMessage(row: ActivityRow): string {
    switch (row.type) {
      case 'comment_created':
        return `${row.actor_name} commented on "${row.target_title ?? 'a post'}"`
      case 'comment_replied':
        return `${row.actor_name} replied to a comment`
      case 'article_created':
        return `${row.actor_name} created article "${row.target_title}"`
      case 'article_published':
        return `${row.actor_name} published "${row.target_title}"`
      case 'article_liked':
        return `${row.actor_name} liked "${row.target_title}"`
      case 'project_created':
        return `${row.actor_name} created project "${row.target_title}"`
      case 'project_liked':
        return `${row.actor_name} liked project "${row.target_title}"`
      case 'user_registered':
        return `${row.actor_name} joined the platform`
      case 'user_verified':
        return `${row.actor_name} verified their email`
      default:
        return `${row.actor_name} performed an action`
    }
  }
}
