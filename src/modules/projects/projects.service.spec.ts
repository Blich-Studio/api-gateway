/// <reference types="vitest/globals" />
import { Test, TestingModule } from '@nestjs/testing'
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common'
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

    it('should apply type filter', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ total: '1' }] })
        .mockResolvedValueOnce({ rows: [baseProjectRow] })
        .mockResolvedValueOnce({ rows: [] }) // getTagsForProject

      await service.findAll(
        { type: 'game', page: 1, limit: 10, sort: 'createdAt', order: 'desc' },
        undefined
      )

      const countQuery = mockDb.query.mock.calls[0][0] as string
      expect(countQuery).toContain('WHERE')
      expect(mockDb.query.mock.calls[0][1]).toContain('game')
    })

    it('should apply search filter', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ total: '0' }] })
        .mockResolvedValueOnce({ rows: [] })

      await service.findAll(
        { search: 'my project', page: 1, limit: 10, sort: 'createdAt', order: 'desc' },
        undefined
      )

      const countQuery = mockDb.query.mock.calls[0][0] as string
      expect(countQuery).toContain('ILIKE')
      expect(mockDb.query.mock.calls[0][1]).toContain('%my project%')
    })

    it('should apply author filter', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ total: '1' }] })
        .mockResolvedValueOnce({ rows: [baseProjectRow] })
        .mockResolvedValueOnce({ rows: [] })

      await service.findAll(
        { authorId: 'user-id-1', page: 1, limit: 10, sort: 'createdAt', order: 'desc' },
        undefined
      )

      expect(mockDb.query.mock.calls[0][1]).toContain('user-id-1')
    })

    it('should apply tags filter', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ total: '0' }] })
        .mockResolvedValueOnce({ rows: [] })

      await service.findAll(
        { tags: 'typescript,game', page: 1, limit: 10, sort: 'createdAt', order: 'desc' },
        undefined
      )

      const countQuery = mockDb.query.mock.calls[0][0] as string
      expect(countQuery).toContain('project_tags')
    })

    it('should apply featured filter', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ total: '1' }] })
        .mockResolvedValueOnce({ rows: [baseProjectRow] })
        .mockResolvedValueOnce({ rows: [] })

      await service.findAll(
        { featured: true, page: 1, limit: 10, sort: 'createdAt', order: 'desc' },
        undefined
      )

      expect(mockDb.query.mock.calls[0][1]).toContain(true)
    })

    it('should return correct pagination meta', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ total: '25' }] })
        .mockResolvedValueOnce({ rows: [baseProjectRow] })
        .mockResolvedValueOnce({ rows: [] })

      const result = await service.findAll(
        { page: 2, limit: 10, sort: 'createdAt', order: 'desc' },
        undefined
      )

      expect(result.meta.page).toBe(2)
      expect(result.meta.total).toBe(25)
      expect(result.meta.totalPages).toBe(3)
      expect(result.meta.hasNext).toBe(true)
      expect(result.meta.hasPrev).toBe(true)
    })
  })

  describe('create', () => {
    // create calls findById at the end: mock order for findById (no userId):
    // 1=slug check, 2=INSERT, [tags inserts], 3=findById SELECT, 4=getTagsForProject, 5=getArticlesForProject

    it('should create a project and return it', async () => {
      // create calls findById(projectId, authorId) → hasUserLiked IS called (authorId provided)
      // Promise.all order in mapToResponse: getTagsForProject, hasUserLiked, getArticlesForProject
      mockDb.query
        .mockResolvedValueOnce({ rows: [] })               // slug conflict check
        .mockResolvedValueOnce({ rows: [baseProjectRow] }) // INSERT RETURNING
        .mockResolvedValueOnce({ rows: [baseProjectRow] }) // findById SELECT
        .mockResolvedValueOnce({ rows: [] })               // getTagsForProject
        .mockResolvedValueOnce({ rows: [] })               // hasUserLiked (authorId provided)
        .mockResolvedValueOnce({ rows: [] })               // getArticlesForProject

      mockTagsService.getOrCreateByNames.mockResolvedValue([])

      const result = await service.create(
        {
          title: 'Test Project',
          type: 'game',
          description: 'Full description',
          status: 'draft',
          featured: false,
          tags: [],
          galleryUrls: [],
        },
        'user-id-1'
      )

      expect(result.title).toBe('Test Project')
    })

    it('should insert tags when provided', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [] })               // slug conflict check
        .mockResolvedValueOnce({ rows: [baseProjectRow] }) // INSERT
        .mockResolvedValueOnce({ rows: [] })               // INSERT project_tags for tag-1
        .mockResolvedValueOnce({ rows: [baseProjectRow] }) // findById SELECT
        .mockResolvedValueOnce({ rows: [] })               // getTagsForProject
        .mockResolvedValueOnce({ rows: [] })               // hasUserLiked (authorId provided)
        .mockResolvedValueOnce({ rows: [] })               // getArticlesForProject

      mockTagsService.getOrCreateByNames.mockResolvedValue([{ id: 'tag-1', name: 'Game', slug: 'game' }])

      await service.create(
        {
          title: 'Test Project',
          type: 'game',
          description: 'Full description',
          status: 'draft',
          featured: false,
          tags: ['Game'],
          galleryUrls: [],
        },
        'user-id-1'
      )

      const tagInsertCall = mockDb.query.mock.calls[2]
      expect(tagInsertCall[0]).toContain('INSERT INTO project_tags')
    })

    it('should throw ConflictException when slug already exists', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'existing-id' }] })

      await expect(
        service.create(
          {
            title: 'Test Project',
            type: 'game',
            description: 'Full description',
            status: 'draft',
            featured: false,
            tags: [],
            galleryUrls: [],
          },
          'user-id-1'
        )
      ).rejects.toThrow(ConflictException)
    })
  })

  describe('update', () => {
    // update calls findById at end: mock order after update:
    // ownership check, [conflict check for slug], UPDATE, [tag delete, tag insert], findById SELECT, getTagsForProject, getArticlesForProject

    it('should update project title', async () => {
      // update calls findById(id, userId) → hasUserLiked IS called (userId provided)
      const updatedRow = { ...baseProjectRow, title: 'Updated Title' }
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ author_id: 'user-id-1', status: 'draft' }] }) // ownership check
        .mockResolvedValueOnce({ rows: [] })               // UPDATE
        .mockResolvedValueOnce({ rows: [updatedRow] })     // findById SELECT
        .mockResolvedValueOnce({ rows: [] })               // getTagsForProject
        .mockResolvedValueOnce({ rows: [] })               // hasUserLiked (userId provided)
        .mockResolvedValueOnce({ rows: [] })               // getArticlesForProject

      const result = await service.update('project-id-1', { title: 'Updated Title' }, 'user-id-1')

      expect(result.title).toBe('Updated Title')
    })

    it('should set published_at when changing status from draft to published', async () => {
      const updatedRow = { ...baseProjectRow, status: 'published' }
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ author_id: 'user-id-1', status: 'draft' }] })
        .mockResolvedValueOnce({ rows: [] })               // UPDATE
        .mockResolvedValueOnce({ rows: [updatedRow] })     // findById SELECT
        .mockResolvedValueOnce({ rows: [] })               // getTagsForProject
        .mockResolvedValueOnce({ rows: [] })               // hasUserLiked
        .mockResolvedValueOnce({ rows: [] })               // getArticlesForProject

      await service.update('project-id-1', { status: 'published' }, 'user-id-1')

      const updateQuery = mockDb.query.mock.calls[1][0] as string
      expect(updateQuery).toContain('published_at')
    })

    it('should NOT set published_at when already published', async () => {
      const updatedRow = { ...baseProjectRow, status: 'published' }
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ author_id: 'user-id-1', status: 'published' }] })
        .mockResolvedValueOnce({ rows: [] })               // UPDATE
        .mockResolvedValueOnce({ rows: [updatedRow] })     // findById SELECT
        .mockResolvedValueOnce({ rows: [] })               // getTagsForProject
        .mockResolvedValueOnce({ rows: [] })               // hasUserLiked
        .mockResolvedValueOnce({ rows: [] })               // getArticlesForProject

      await service.update('project-id-1', { status: 'published' }, 'user-id-1')

      const updateQuery = mockDb.query.mock.calls[1][0] as string
      expect(updateQuery).not.toContain('published_at')
    })

    it('should throw NotFoundException when project does not exist', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] })

      await expect(
        service.update('missing-id', { title: 'New' }, 'user-id-1')
      ).rejects.toThrow(NotFoundException)
    })

    it('should throw ForbiddenException when user is not the author', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ author_id: 'other-user', status: 'draft' }] })

      await expect(
        service.update('project-id-1', { title: 'New' }, 'user-id-1')
      ).rejects.toThrow(ForbiddenException)
    })

    it('should throw ConflictException when slug conflicts with another project', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ author_id: 'user-id-1', status: 'draft' }] }) // ownership check
        .mockResolvedValueOnce({ rows: [{ id: 'other-id' }] })                           // slug conflict

      await expect(
        service.update('project-id-1', { slug: 'existing-slug' }, 'user-id-1')
      ).rejects.toThrow(ConflictException)
    })

    it('should skip UPDATE query when no fields are provided', async () => {
      // no UPDATE query run, but findById(id, userId) IS called → hasUserLiked makes DB call
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ author_id: 'user-id-1', status: 'draft' }] }) // ownership check
        .mockResolvedValueOnce({ rows: [baseProjectRow] })     // findById SELECT
        .mockResolvedValueOnce({ rows: [] })                   // getTagsForProject
        .mockResolvedValueOnce({ rows: [] })                   // hasUserLiked (userId provided)
        .mockResolvedValueOnce({ rows: [] })                   // getArticlesForProject

      await service.update('project-id-1', {}, 'user-id-1')

      // 5 calls: ownership + findById SELECT + getTagsForProject + hasUserLiked + getArticlesForProject
      expect(mockDb.query).toHaveBeenCalledTimes(5)
    })

    it('should handle tags update — delete old and insert new', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ author_id: 'user-id-1', status: 'draft' }] }) // ownership check
        .mockResolvedValueOnce({ rows: [] })               // UPDATE (title)
        .mockResolvedValueOnce({ rows: [] })               // DELETE project_tags
        .mockResolvedValueOnce({ rows: [] })               // INSERT project_tags
        .mockResolvedValueOnce({ rows: [baseProjectRow] }) // findById SELECT
        .mockResolvedValueOnce({ rows: [] })               // getTagsForProject
        .mockResolvedValueOnce({ rows: [] })               // hasUserLiked (userId provided)
        .mockResolvedValueOnce({ rows: [] })               // getArticlesForProject

      mockTagsService.getOrCreateByNames.mockResolvedValue([{ id: 'tag-1', name: 'Game', slug: 'game' }])

      await service.update('project-id-1', { title: 'New', tags: ['Game'] }, 'user-id-1')

      const deleteTagsCall = mockDb.query.mock.calls[2]
      expect(deleteTagsCall[0]).toContain('DELETE FROM project_tags')

      const insertTagCall = mockDb.query.mock.calls[3]
      expect(insertTagCall[0]).toContain('INSERT INTO project_tags')
    })
  })

  describe('delete', () => {
    it('should delete project successfully', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ author_id: 'user-id-1' }] }) // ownership check
        .mockResolvedValueOnce({ rows: [] })                            // DELETE

      await expect(service.delete('project-id-1', 'user-id-1')).resolves.toBeUndefined()

      const deleteCall = mockDb.query.mock.calls[1]
      expect(deleteCall[0]).toContain('DELETE FROM projects')
      expect(deleteCall[1]).toContain('project-id-1')
    })

    it('should throw NotFoundException when project does not exist', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] })

      await expect(service.delete('missing-id', 'user-id-1')).rejects.toThrow(NotFoundException)
    })

    it('should throw ForbiddenException when user is not the author', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ author_id: 'other-user' }] })

      await expect(service.delete('project-id-1', 'user-id-1')).rejects.toThrow(ForbiddenException)
    })
  })

  describe('incrementViews', () => {
    it('should run the update query', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] })

      await service.incrementViews('project-id-1')

      const [query, params] = mockDb.query.mock.calls[0]
      expect(query).toContain('views_count = views_count + 1')
      expect(params[0]).toBe('project-id-1')
    })
  })
})
