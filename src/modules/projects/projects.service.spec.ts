/// <reference types="vitest/globals" />
import { Test, TestingModule } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'
import { ProjectsService } from './projects.service'
import { POSTGRES_CLIENT } from '../database/postgres.module'
import { TagsService } from '../tags/tags.service'

const mockDb = {
  query: vi.fn(),
}

const mockTagsService = {
  getOrCreateByNames: vi.fn(),
}

const baseProjectRow = {
  id: 'project-id-1',
  title: 'Test Project',
  slug: 'test-project',
  type: 'game',
  description: 'Full description',
  short_description: 'Short desc',
  cover_image_url: null,
  gallery_urls: [],
  github_url: null,
  itchio_url: null,
  steam_url: null,
  youtube_url: null,
  author_id: 'user-id-1',
  author_display_name: 'Filip',
  author_avatar_url: null,
  status: 'published',
  featured: false,
  likes_count: 0,
  views_count: 0,
  published_at: new Date('2026-01-01'),
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-01-01'),
}

const baseArticleRow = {
  id: 'article-id-1',
  title: 'Related Article',
  slug: 'related-article',
  perex: 'Article perex',
  cover_image_url: null,
  published_at: new Date('2026-02-01'),
  content: 'Some article content for reading',
}

describe('ProjectsService', () => {
  let service: ProjectsService

  beforeEach(async () => {
    vi.resetAllMocks()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: POSTGRES_CLIENT, useValue: mockDb },
        { provide: TagsService, useValue: mockTagsService },
      ],
    }).compile()

    service = module.get<ProjectsService>(ProjectsService)
  })

  // hasUserLiked skips db.query when userId is undefined — mock order for findById (no userId):
  // call 1: main SELECT, call 2: getTagsForProject, call 3: getArticlesForProject

  describe('findById', () => {
    it('should include linked articles in response', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [baseProjectRow] }) // main SELECT
        .mockResolvedValueOnce({ rows: [] })               // getTagsForProject
        .mockResolvedValueOnce({ rows: [baseArticleRow] }) // getArticlesForProject

      const result = await service.findById('project-id-1')

      expect(result.articles).toHaveLength(1)
      expect(result.articles[0].id).toBe('article-id-1')
      expect(result.articles[0].title).toBe('Related Article')
      expect(result.articles[0].slug).toBe('related-article')
    })

    it('should return empty articles array when no linked articles', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [baseProjectRow] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })

      const result = await service.findById('project-id-1')

      expect(result.articles).toEqual([])
    })

    it('should calculate readTime for linked articles', async () => {
      const longContent = 'word '.repeat(400) // 400 words → 2 min
      mockDb.query
        .mockResolvedValueOnce({ rows: [baseProjectRow] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ ...baseArticleRow, content: longContent }] })

      const result = await service.findById('project-id-1')

      expect(result.articles[0].readTime).toBe(2)
    })

    it('should query articles filtered by project_id and published status', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [baseProjectRow] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })

      await service.findById('project-id-1')

      const articlesQuery = mockDb.query.mock.calls[2][0] as string
      expect(articlesQuery).toContain("status = 'published'")
      expect(articlesQuery).toContain('ORDER BY a.published_at DESC')
      expect(mockDb.query.mock.calls[2][1]).toContain('project-id-1')
    })

    it('should throw NotFoundException when project does not exist', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] })

      await expect(service.findById('missing-id')).rejects.toThrow(NotFoundException)
    })
  })

  describe('findBySlug', () => {
    it('should include linked articles in response', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [baseProjectRow] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [baseArticleRow] })

      const result = await service.findBySlug('test-project')

      expect(result.articles).toHaveLength(1)
    })
  })

  describe('findAll (list)', () => {
    it('should NOT call getArticlesForProject — list items do not include articles', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ total: '1' }] })  // count query
        .mockResolvedValueOnce({ rows: [baseProjectRow] })  // list SELECT
        .mockResolvedValueOnce({ rows: [] })                // getTagsForProject (per item, userId=undefined → no hasUserLiked)

      await service.findAll(
        { status: 'published', page: 1, limit: 10, sort: 'createdAt', order: 'desc' },
        undefined
      )

      // Verify no query hit the articles table looking for project_id
      const allQueries = mockDb.query.mock.calls.map(c => c[0] as string)
      const articlesFromProject = allQueries.filter(q =>
        q.includes('FROM articles') && q.includes('project_id')
      )
      expect(articlesFromProject).toHaveLength(0)
    })
  })
})
