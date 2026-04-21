/// <reference types="vitest/globals" />
import { Test, TestingModule } from '@nestjs/testing'
import { ConflictException, NotFoundException } from '@nestjs/common'
import { TagsService } from './tags.service'
import { POSTGRES_CLIENT } from '../database/postgres.module'

const mockDb = {
  query: vi.fn(),
}

const baseTagRow = {
  id: 'tag-id-1',
  name: 'TypeScript',
  slug: 'typescript',
  description: 'A typed superset of JavaScript',
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-01-01'),
}

describe('TagsService', () => {
  let service: TagsService

  beforeEach(async () => {
    vi.resetAllMocks()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TagsService,
        { provide: POSTGRES_CLIENT, useValue: mockDb },
      ],
    }).compile()

    service = module.get<TagsService>(TagsService)
  })

  describe('findAll', () => {
    it('should return all tags without search param', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [baseTagRow] })

      const result = await service.findAll()

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('TypeScript')
      expect(result[0].slug).toBe('typescript')

      const [query, params] = mockDb.query.mock.calls[0]
      expect(query).not.toContain('WHERE')
      expect(params).toHaveLength(0)
    })

    it('should filter by search when provided', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [baseTagRow] })

      const result = await service.findAll('type')

      expect(result).toHaveLength(1)

      const [query, params] = mockDb.query.mock.calls[0]
      expect(query).toContain('WHERE')
      expect(query).toContain('ILIKE')
      expect(params[0]).toBe('%type%')
    })

    it('should return empty array when no tags match', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] })

      const result = await service.findAll('nonexistent')

      expect(result).toEqual([])
    })
  })

  describe('findById', () => {
    it('should return a tag when found', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [baseTagRow] })

      const result = await service.findById('tag-id-1')

      expect(result.id).toBe('tag-id-1')
      expect(result.name).toBe('TypeScript')
      expect(result.description).toBe('A typed superset of JavaScript')
    })

    it('should throw NotFoundException when tag does not exist', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] })

      await expect(service.findById('missing-id')).rejects.toThrow(NotFoundException)
    })
  })

  describe('findBySlug', () => {
    it('should return a tag when found by slug', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [baseTagRow] })

      const result = await service.findBySlug('typescript')

      expect(result.slug).toBe('typescript')
      expect(result.name).toBe('TypeScript')
    })

    it('should throw NotFoundException when slug does not exist', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] })

      await expect(service.findBySlug('missing-slug')).rejects.toThrow(NotFoundException)
    })
  })

  describe('create', () => {
    it('should create a tag and return it', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [] })         // conflict check
        .mockResolvedValueOnce({ rows: [baseTagRow] }) // INSERT

      const result = await service.create({ name: 'TypeScript' })

      expect(result.name).toBe('TypeScript')
      expect(result.slug).toBe('typescript')

      const insertCall = mockDb.query.mock.calls[1]
      expect(insertCall[0]).toContain('INSERT INTO tags')
    })

    it('should create a tag with description', async () => {
      const rowWithDesc = { ...baseTagRow, description: 'My desc' }
      mockDb.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [rowWithDesc] })

      const result = await service.create({ name: 'TypeScript', description: 'My desc' })

      expect(result.description).toBe('My desc')

      const insertParams = mockDb.query.mock.calls[1][1] as unknown[]
      expect(insertParams[2]).toBe('My desc')
    })

    it('should pass null for description when not provided', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ ...baseTagRow, description: null }] })

      await service.create({ name: 'TypeScript' })

      const insertParams = mockDb.query.mock.calls[1][1] as unknown[]
      expect(insertParams[2]).toBeNull()
    })

    it('should throw ConflictException when tag with same name already exists', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'existing-id' }] })

      await expect(service.create({ name: 'TypeScript' })).rejects.toThrow(ConflictException)
    })

    it('should generate slug from name', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ ...baseTagRow, slug: 'hello-world' }] })

      await service.create({ name: 'Hello World' })

      const conflictParams = mockDb.query.mock.calls[0][1] as unknown[]
      expect(conflictParams[1]).toBe('hello-world')
    })
  })

  describe('update', () => {
    it('should update the tag name and regenerate slug', async () => {
      const updatedRow = { ...baseTagRow, name: 'JavaScript', slug: 'javascript' }
      mockDb.query
        .mockResolvedValueOnce({ rows: [baseTagRow] })  // exists check
        .mockResolvedValueOnce({ rows: [] })            // conflict check
        .mockResolvedValueOnce({ rows: [updatedRow] })  // UPDATE

      const result = await service.update('tag-id-1', { name: 'JavaScript' })

      expect(result.name).toBe('JavaScript')
      expect(result.slug).toBe('javascript')
    })

    it('should update the description only', async () => {
      const updatedRow = { ...baseTagRow, description: 'New desc' }
      mockDb.query
        .mockResolvedValueOnce({ rows: [baseTagRow] })  // exists check
        .mockResolvedValueOnce({ rows: [updatedRow] })  // UPDATE

      const result = await service.update('tag-id-1', { description: 'New desc' })

      expect(result.description).toBe('New desc')
    })

    it('should return existing tag when no updates provided', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [baseTagRow] })

      const result = await service.update('tag-id-1', {})

      expect(result.name).toBe('TypeScript')
      // only one query (the exists check), no UPDATE
      expect(mockDb.query).toHaveBeenCalledTimes(1)
    })

    it('should throw NotFoundException when tag does not exist', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] })

      await expect(service.update('missing-id', { name: 'New' })).rejects.toThrow(NotFoundException)
    })

    it('should throw ConflictException when new name conflicts with another tag', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [baseTagRow] })         // exists check
        .mockResolvedValueOnce({ rows: [{ id: 'other-id' }] }) // conflict check

      await expect(service.update('tag-id-1', { name: 'Existing Tag' })).rejects.toThrow(ConflictException)
    })
  })

  describe('delete', () => {
    it('should delete the tag successfully', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'tag-id-1' }] })

      await expect(service.delete('tag-id-1')).resolves.toBeUndefined()

      const [query, params] = mockDb.query.mock.calls[0]
      expect(query).toContain('DELETE FROM tags')
      expect(params[0]).toBe('tag-id-1')
    })

    it('should throw NotFoundException when tag does not exist', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] })

      await expect(service.delete('missing-id')).rejects.toThrow(NotFoundException)
    })
  })

  describe('getOrCreateByNames', () => {
    it('should return empty array when names is empty', async () => {
      const result = await service.getOrCreateByNames([])

      expect(result).toEqual([])
      expect(mockDb.query).not.toHaveBeenCalled()
    })

    it('should return existing tag when found by slug', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [baseTagRow] })

      const result = await service.getOrCreateByNames(['TypeScript'])

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('TypeScript')
      // Only one query (SELECT), no INSERT
      expect(mockDb.query).toHaveBeenCalledTimes(1)
    })

    it('should create tag when not found', async () => {
      const newRow = { ...baseTagRow, name: 'NewTag', slug: 'newtag' }
      mockDb.query
        .mockResolvedValueOnce({ rows: [] })          // SELECT finds nothing
        .mockResolvedValueOnce({ rows: [newRow] })    // INSERT

      const result = await service.getOrCreateByNames(['NewTag'])

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('NewTag')
      expect(mockDb.query).toHaveBeenCalledTimes(2)

      const insertCall = mockDb.query.mock.calls[1]
      expect(insertCall[0]).toContain('INSERT INTO tags')
    })

    it('should handle mix of existing and new tags', async () => {
      const existingRow = { ...baseTagRow }
      const newRow = { ...baseTagRow, id: 'tag-id-2', name: 'NewTag', slug: 'newtag' }

      mockDb.query
        .mockResolvedValueOnce({ rows: [existingRow] }) // first tag found
        .mockResolvedValueOnce({ rows: [] })             // second tag not found
        .mockResolvedValueOnce({ rows: [newRow] })       // second tag created

      const result = await service.getOrCreateByNames(['TypeScript', 'NewTag'])

      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('TypeScript')
      expect(result[1].name).toBe('NewTag')
    })
  })
})
