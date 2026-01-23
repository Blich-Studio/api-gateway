import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { TagResponseSchema } from '../../tags/dto/tag.dto'

// Author info embedded in article response
export const AuthorSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
})

// Article Response DTO
export const ArticleResponseSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  slug: z.string(),
  perex: z.string(),
  content: z.string(),
  coverImageUrl: z.string().nullable(),
  author: AuthorSchema,
  status: z.enum(['draft', 'published', 'archived']),
  featured: z.boolean(),
  tags: z.array(TagResponseSchema),
  likesCount: z.number(),
  viewsCount: z.number(),
  isLiked: z.boolean().optional(),
  readTime: z.number(), // Estimated read time in minutes
  publishedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export class ArticleResponseDto extends createZodDto(ArticleResponseSchema) {}

// Article list item (without full content)
export const ArticleListItemSchema = ArticleResponseSchema.omit({ content: true })

export class ArticleListItemDto extends createZodDto(ArticleListItemSchema) {}

// Helper to handle empty strings and null as undefined for optional URL fields
const optionalUrl = z.preprocess(
  val => (val === '' || val === null ? undefined : val),
  z.string().url().optional()
)

// Create Article DTO
export const CreateArticleSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be less than 200 characters'),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(100, 'Slug must be less than 100 characters')
    .optional(),
  perex: z.string().min(1, 'Perex is required').max(500, 'Perex must be less than 500 characters'),
  content: z.string().min(1, 'Content is required'),
  coverImageUrl: optionalUrl,
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  featured: z.boolean().default(false),
  tags: z.array(z.string()).default([]), // Tag names
})

export class CreateArticleDto extends createZodDto(CreateArticleSchema) {}

// Update Article DTO
export const UpdateArticleSchema = CreateArticleSchema.partial()

export class UpdateArticleDto extends createZodDto(UpdateArticleSchema) {}

// Query DTOs
export const ArticleQuerySchema = z.object({
  status: z.enum(['draft', 'published', 'archived']).optional(),
  authorId: z.string().uuid().optional(),
  tags: z.string().optional(), // Comma-separated tag slugs
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  sort: z
    .enum(['createdAt', 'publishedAt', 'likesCount', 'viewsCount', 'title'])
    .default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
})

export class ArticleQueryDto extends createZodDto(ArticleQuerySchema) {}

// Pagination meta
export const PaginationMetaSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  totalPages: z.number(),
  hasNext: z.boolean(),
  hasPrev: z.boolean(),
})

export type ArticleResponse = z.infer<typeof ArticleResponseSchema>
export type ArticleListItem = z.infer<typeof ArticleListItemSchema>
export type PaginationMeta = z.infer<typeof PaginationMetaSchema>
