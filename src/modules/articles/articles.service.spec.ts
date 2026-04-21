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
})
