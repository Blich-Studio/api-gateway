import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import 'reflect-metadata'
import { UpdateArticleDto } from './update-article.dto'
import { UpdateCommentDto } from './update-comment.dto'

const expectValid = async (dto: object) => {
  const errors = await validate(dto)
  expect(errors).toHaveLength(0)
}

const expectInvalid = async (dto: object, property: string) => {
  const errors = await validate(dto)
  expect(errors).not.toHaveLength(0)
  expect(errors.some(err => err.property === property)).toBe(true)
}

describe('Editorial DTO validation', () => {
  describe('UpdateArticleDto', () => {
    it('accepts partial updates with valid fields', async () => {
      const dto = plainToInstance(UpdateArticleDto, {
        title: 'Updated Title',
        slug: 'updated-title',
        perex: 'New summary',
        status: 'draft',
        tags: ['rpg', 'update'],
      })

      await expectValid(dto)
    })

    it('rejects invalid Mongo authorId values', async () => {
      const dto = plainToInstance(UpdateArticleDto, {
        authorId: 'not-a-mongo-id',
      })

      await expectInvalid(dto, 'authorId')
    })

    it('rejects statuses outside the allowed enum', async () => {
      const dto = plainToInstance(UpdateArticleDto, {
        status: 'pending',
      })

      await expectInvalid(dto, 'status')
    })

    it('rejects tags payloads that are not arrays of strings', async () => {
      const dto = plainToInstance(UpdateArticleDto, {
        tags: 'single-tag',
      })

      await expectInvalid(dto, 'tags')
    })
  })

  describe('UpdateCommentDto', () => {
    it('accepts valid content-only updates', async () => {
      const dto = plainToInstance(UpdateCommentDto, {
        content: 'Edited comment body',
      })

      await expectValid(dto)
    })

    it('rejects empty comment content', async () => {
      const dto = plainToInstance(UpdateCommentDto, {
        content: '',
      })

      await expectInvalid(dto, 'content')
    })

    it('rejects status values longer than 50 characters', async () => {
      const dto = plainToInstance(UpdateCommentDto, {
        status: 'x'.repeat(51),
      })

      await expectInvalid(dto, 'status')
    })
  })
})
