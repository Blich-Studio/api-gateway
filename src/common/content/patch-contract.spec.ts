import { describe, expect, it } from 'vitest'
import { CreateArticleSchema, UpdateArticleSchema } from '../../modules/articles/dto/article.dto'
import { CreateProjectSchema, UpdateProjectSchema } from '../../modules/projects/dto/project.dto'

// Regression: Zod 4 partial() preserves create-time defaults inside optional fields.
// An ordinary title edit must not silently unpublish content or erase its metadata.
describe('content patch contract', () => {
  it.each([UpdateArticleSchema, UpdateProjectSchema])('changes only explicitly supplied fields', schema => {
    expect(schema.parse({ title: 'Revised title' })).toEqual({ title: 'Revised title' })
    expect(schema.parse({})).toEqual({})
    expect(schema.parse({ status: 'published' })).toEqual({ status: 'published' })
  })

  it('retains create-time defaults', () => {
    expect(CreateArticleSchema.parse({ title: 'A', perex: 'B', content: 'C' })).toMatchObject({ status: 'draft', featured: false, tags: [] })
    expect(CreateProjectSchema.parse({ title: 'A', description: 'B' })).toMatchObject({ type: 'other', status: 'draft', featured: false, tags: [], galleryUrls: [] })
  })

  it.each(['', null])('supports explicitly clearing nullable metadata with %s', value => {
    expect(UpdateArticleSchema.parse({ coverImageUrl: value })).toEqual({ coverImageUrl: null })
    expect(UpdateProjectSchema.parse({ channel: value, platform: value, license: value, embedUrl: value })).toEqual({ channel: null, platform: null, license: null, embedUrl: null })
  })

  it('preserves explicit false and empty collections', () => {
    expect(UpdateProjectSchema.parse({ featured: false, tags: [], galleryUrls: [] })).toEqual({ featured: false, tags: [], galleryUrls: [] })
  })
})
