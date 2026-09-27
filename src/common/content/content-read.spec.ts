import { describe, expect, it, vi } from 'vitest'
import { ArticlesService } from '../../modules/articles/articles.service'
import { ProjectsService } from '../../modules/projects/projects.service'
import { CommentsService } from '../../modules/comments/comments.service'
import { ArticleQuerySchema } from '../../modules/articles/dto/article.dto'
import { ProjectQuerySchema } from '../../modules/projects/dto/project.dto'
import { CommentQuerySchema } from '../../modules/comments/dto/comment.dto'
import type { PostgresClient } from '../../modules/database/postgres.module'
import type { TagsService } from '../../modules/tags/tags.service'

function services() {
  const query = vi.fn(async (sql: string, _params?: unknown[]) => ({ rows: sql.includes('COUNT(*)') ? [{ total: '0' }] : [], rowCount: 0 }))
  const db = { query } as unknown as PostgresClient
  const tags = {} as TagsService
  return { query, articles: new ArticlesService(db, tags), projects: new ProjectsService(db, tags), comments: new CommentsService(db) }
}

describe('read paths enforce visibility before pagination and lookup', () => {
  for (const entity of ['articles', 'projects', 'comments'] as const) {
    it.each([undefined, 'current-user'])(`${entity} filters both counts and rows for viewer %s`, async viewer => {
      const current = services()
      if (entity === 'articles') await current.articles.findAll(ArticleQuerySchema.parse({ status: 'draft', authorId: '11111111-1111-4111-8111-111111111111' }), viewer)
      else if (entity === 'projects') await current.projects.findAll(ProjectQuerySchema.parse({ status: 'draft', channel: 'play' }), viewer)
      else await current.comments.findAll(CommentQuerySchema.parse({ status: 'pending' }), viewer)
      expect(current.query).toHaveBeenCalledTimes(2)
      for (const [sql, params] of current.query.mock.calls) {
        expect(sql).toContain('content_viewer.is_verified = true')
        expect(params).toContain(viewer ?? null)
        if (entity === 'comments') expect(sql).toContain('comment_viewer.is_verified = true')
      }
    })
    it(`${entity} returns not-found when visibility excludes an ID`, async () => {
      const current = services()
      await expect(current[entity].findById('content-id')).rejects.toMatchObject({ status: 404 })
      expect(current.query).toHaveBeenCalledOnce()
      expect(current.query.mock.calls[0][0]).toContain('content_viewer.is_verified = true')
      expect(current.query.mock.calls[0][1]).toEqual(['content-id', null])
    })
  }
  it.each(['articles', 'projects'] as const)('%s also protects slug lookup', async entity => {
    const current = services()
    await expect(current[entity].findBySlug('private-slug')).rejects.toMatchObject({ status: 404 })
    expect(current.query.mock.calls[0][0]).toContain('content_viewer.is_verified = true')
    expect(current.query.mock.calls[0][1]).toEqual(['private-slug', null])
  })
})
