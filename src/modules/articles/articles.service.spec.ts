/// <reference types="vitest/globals" />
import { Test, TestingModule } from '@nestjs/testing'
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { ArticlesService } from './articles.service'
import { POSTGRES_CLIENT } from '../database/postgres.module'
import { TagsService } from '../tags/tags.service'

const mockDb = {
  query: vi.fn(),
}

const mockTagsService = {
  getOrCreateByNames: vi.fn(),
}

const baseArticleRow = {
  id: 'article-id-1',
  title: 'Test Article',
  slug: 'test-article',
  perex: 'Test perex',
  content: 'Test content with some words here',
  cover_image_url: null,
  author_id: 'user-id-1',
  author_display_name: 'Filip',
  author_avatar_url: null,
  status: 'published',
  featured: false,
  likes_count: 0,
  views_count: 0,
  project_id: null,
  published_at: new Date('2026-01-01'),
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-01-01'),
}

describe('ArticlesService', () => {
  let service: ArticlesService

  beforeEach(async () => {
    vi.resetAllMocks()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticlesService,
        { provide: POSTGRES_CLIENT, useValue: mockDb },
        { provide: TagsService, useValue: mockTagsService },
      ],
    }).compile()

    service = module.get<ArticlesService>(ArticlesService)
  })

  // create/update call findById with authorId as userId → hasUserLiked DOES run (userId provided)
  // Mock order for create: 1=slug check, 2=INSERT, 3=findById SELECT, 4=getTagsForArticle, 5=hasUserLiked
  // Mock order for findById (no userId): 1=SELECT, 2=getTagsForArticle (hasUserLiked skipped)

  describe('create', () => {
    it('should persist projectId when provided', async () => {
      const articleRow = { ...baseArticleRow, id: 'new-id', project_id: 'proj-1' }
      mockDb.query
        .mockResolvedValueOnce({ rows: [] })             // slug conflict check
        .mockResolvedValueOnce({ rows: [articleRow] })   // INSERT
        .mockResolvedValueOnce({ rows: [articleRow] })   // findById SELECT
        .mockResolvedValueOnce({ rows: [] })             // getTagsForArticle
        .mockResolvedValueOnce({ rows: [] })             // hasUserLiked (authorId used as userId)

      mockTagsService.getOrCreateByNames.mockResolvedValue([])

      await service.create(
        { title: 'Test', perex: 'Perex', content: 'Content', status: 'draft', featured: false, tags: [], projectId: 'proj-1' },
        'user-id-1'
      )

      const insertCall = mockDb.query.mock.calls[1]
      expect(insertCall[0]).toContain('project_id')
      expect(insertCall[1]).toContain('proj-1')
    })

    it('should persist null when projectId not provided', async () => {
      const articleRow = { ...baseArticleRow, id: 'new-id' }
      mockDb.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [articleRow] })
        .mockResolvedValueOnce({ rows: [articleRow] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })             // hasUserLiked

      mockTagsService.getOrCreateByNames.mockResolvedValue([])

      await service.create(
        { title: 'Test', perex: 'Perex', content: 'Content', status: 'draft', featured: false, tags: [] },
        'user-id-1'
      )

      const params = mockDb.query.mock.calls[1][1] as unknown[]
      expect(params[params.length - 1]).toBeNull()
    })

    it('should throw ConflictException when slug already exists', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'existing' }] })

      await expect(
        service.create(
          { title: 'Test', perex: 'P', content: 'C', status: 'draft', featured: false, tags: [] },
          'user-id-1'
        )
      ).rejects.toThrow(ConflictException)
    })
  })

  describe('update', () => {
    it('should update projectId when provided', async () => {
      const updatedRow = { ...baseArticleRow, project_id: 'proj-2' }
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ author_id: 'user-id-1', status: 'draft' }] }) // ownership check
        .mockResolvedValueOnce({ rows: [] })             // UPDATE
        .mockResolvedValueOnce({ rows: [updatedRow] })   // findById SELECT
        .mockResolvedValueOnce({ rows: [] })             // getTagsForArticle
        .mockResolvedValueOnce({ rows: [] })             // hasUserLiked (userId provided)

      const result = await service.update('article-id-1', { projectId: 'proj-2' }, 'user-id-1')
      expect(result.projectId).toBe('proj-2')

      const updateCall = mockDb.query.mock.calls[1]
      expect(updateCall[0]).toContain('project_id')
    })

    it('should clear projectId when set to null', async () => {
      const updatedRow = { ...baseArticleRow, project_id: null }
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ author_id: 'user-id-1', status: 'draft' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [updatedRow] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })             // hasUserLiked

      const result = await service.update('article-id-1', { projectId: null }, 'user-id-1')
      expect(result.projectId).toBeNull()

      const updateParams = mockDb.query.mock.calls[1][1] as unknown[]
      expect(updateParams).toContain(null)
    })

    it('should throw ForbiddenException when user is not the author', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ author_id: 'other-user', status: 'draft' }] })

      await expect(
        service.update('article-id-1', { title: 'New' }, 'user-id-1')
      ).rejects.toThrow(ForbiddenException)
    })

    it('should throw NotFoundException when article does not exist', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] })

      await expect(
        service.update('missing-id', { title: 'New' }, 'user-id-1')
      ).rejects.toThrow(NotFoundException)
    })
  })

  describe('findById', () => {
    it('should include projectId in response', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ ...baseArticleRow, project_id: 'proj-x' }] }) // SELECT
        .mockResolvedValueOnce({ rows: [] }) // getTagsForArticle

      const result = await service.findById('article-id-1')
      expect(result.projectId).toBe('proj-x')
    })

    it('should return null projectId when not linked', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ ...baseArticleRow, project_id: null }] })
        .mockResolvedValueOnce({ rows: [] })

      const result = await service.findById('article-id-1')
      expect(result.projectId).toBeNull()
    })

    it('should throw NotFoundException when article does not exist', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] })

      await expect(service.findById('missing-id')).rejects.toThrow(NotFoundException)
    })
  })

  describe('findAll', () => {
    it('should return paginated articles with no filters', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ total: '2' }] })          // count
        .mockResolvedValueOnce({ rows: [baseArticleRow] })           // list SELECT
        .mockResolvedValueOnce({ rows: [] })                         // getTagsForArticlesBatch (1 article)
        // getLikedArticleIdsBatch skipped — no userId

      const result = await service.findAll(
        { page: 1, limit: 10, sort: 'createdAt', order: 'desc' },
        undefined
      )

      expect(result.data).toHaveLength(1)
      expect(result.meta.total).toBe(2)
      expect(result.meta.page).toBe(1)
      expect(result.meta.hasNext).toBe(false)
      expect(result.meta.hasPrev).toBe(false)
    })

    it('should apply status filter', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ total: '1' }] })
        .mockResolvedValueOnce({ rows: [baseArticleRow] })
        .mockResolvedValueOnce({ rows: [] }) // getTagsForArticlesBatch (1 article)
        // getLikedArticleIdsBatch skipped — no userId

      await service.findAll(
        { status: 'published', page: 1, limit: 10, sort: 'createdAt', order: 'desc' },
        undefined
      )

      const countQuery = mockDb.query.mock.calls[0][0] as string
      expect(countQuery).toContain('WHERE')
      expect(mockDb.query.mock.calls[0][1]).toContain('published')
    })

    it('should apply search filter', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ total: '0' }] }) // count
        .mockResolvedValueOnce({ rows: [] })               // data SELECT (0 rows — batch calls skip)

      await service.findAll(
        { search: 'hello', page: 1, limit: 10, sort: 'createdAt', order: 'desc' },
        undefined
      )

      const countQuery = mockDb.query.mock.calls[0][0] as string
      expect(countQuery).toContain('ILIKE')
      expect(mockDb.query.mock.calls[0][1]).toContain('%hello%')
    })

    it('should apply tag filter', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ total: '0' }] }) // count
        .mockResolvedValueOnce({ rows: [] })               // data SELECT (0 rows — batch calls skip)

      await service.findAll(
        { tags: 'typescript,nestjs', page: 1, limit: 10, sort: 'createdAt', order: 'desc' },
        undefined
      )

      const countQuery = mockDb.query.mock.calls[0][0] as string
      expect(countQuery).toContain('article_tags')
    })

    it('should apply author filter', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ total: '1' }] })
        .mockResolvedValueOnce({ rows: [baseArticleRow] })
        .mockResolvedValueOnce({ rows: [] }) // getTagsForArticlesBatch (1 article)
        // getLikedArticleIdsBatch skipped — no userId

      await service.findAll(
        { authorId: 'user-id-1', page: 1, limit: 10, sort: 'createdAt', order: 'desc' },
        undefined
      )

      const countQuery = mockDb.query.mock.calls[0][0] as string
      expect(countQuery).toContain('author_id')
      expect(mockDb.query.mock.calls[0][1]).toContain('user-id-1')
    })

    it('should calculate hasNext and hasPrev correctly for page 2', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ total: '25' }] })
        .mockResolvedValueOnce({ rows: [baseArticleRow] })
        .mockResolvedValueOnce({ rows: [] }) // getTagsForArticlesBatch (1 article)
        // getLikedArticleIdsBatch skipped — no userId

      const result = await service.findAll(
        { page: 2, limit: 10, sort: 'createdAt', order: 'desc' },
        undefined
      )

      expect(result.meta.hasNext).toBe(true)
      expect(result.meta.hasPrev).toBe(true)
      expect(result.meta.totalPages).toBe(3)
    })

    it('should fetch liked article ids when userId is provided', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ total: '1' }] })
        .mockResolvedValueOnce({ rows: [baseArticleRow] })
        .mockResolvedValueOnce({ rows: [] })                               // getTagsForArticlesBatch
        .mockResolvedValueOnce({ rows: [{ article_id: 'article-id-1' }] }) // getLikedArticleIdsBatch

      const result = await service.findAll(
        { page: 1, limit: 10, sort: 'createdAt', order: 'desc' },
        'user-id-1'
      )

      expect(result.data[0].isLiked).toBe(true)
    })
  })

  describe('findBySlug', () => {
    it('should return article when found by slug', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [baseArticleRow] }) // SELECT
        .mockResolvedValueOnce({ rows: [] })               // getTagsForArticle

      const result = await service.findBySlug('test-article')

      expect(result.slug).toBe('test-article')
      expect(result.title).toBe('Test Article')
    })

    it('should include userId for hasUserLiked when provided', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [baseArticleRow] }) // SELECT
        .mockResolvedValueOnce({ rows: [] })               // getTagsForArticle
        .mockResolvedValueOnce({ rows: [] })               // hasUserLiked

      const result = await service.findBySlug('test-article', 'user-id-1')

      expect(result.isLiked).toBe(false)
    })

    it('should throw NotFoundException when slug does not exist', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] })

      await expect(service.findBySlug('missing-slug')).rejects.toThrow(NotFoundException)
    })
  })

  describe('delete', () => {
    it('should delete article successfully', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ author_id: 'user-id-1' }] }) // ownership check
        .mockResolvedValueOnce({ rows: [] })                            // DELETE

      await expect(service.delete('article-id-1', 'user-id-1')).resolves.toBeUndefined()

      expect(mockDb.query).toHaveBeenCalledTimes(2)
      const deleteCall = mockDb.query.mock.calls[1]
      expect(deleteCall[0]).toContain('DELETE FROM articles')
    })

    it('should throw NotFoundException when article does not exist', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] })

      await expect(service.delete('missing-id', 'user-id-1')).rejects.toThrow(NotFoundException)
    })

    it('should throw ForbiddenException when user is not the author', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ author_id: 'other-user' }] })

      await expect(service.delete('article-id-1', 'user-id-1')).rejects.toThrow(ForbiddenException)
    })
  })

  describe('incrementViews', () => {
    it('should run the update query', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] })

      await service.incrementViews('article-id-1')

      const [query, params] = mockDb.query.mock.calls[0]
      expect(query).toContain('views_count = views_count + 1')
      expect(params[0]).toBe('article-id-1')
    })
  })
})
