import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { TagResponseSchema } from '../../tags/dto/tag.dto'

// Author info embedded in project response
export const AuthorSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
})

// Project types
export const ProjectTypeEnum = z.enum(['game', 'engine', 'tool', 'animation', 'artwork', 'other'])
export type ProjectType = z.infer<typeof ProjectTypeEnum>

// Project Response DTO
export const ProjectResponseSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  slug: z.string(),
  type: ProjectTypeEnum,
  description: z.string(),
  shortDescription: z.string().nullable(),
  coverImageUrl: z.string().nullable(),
  galleryUrls: z.array(z.string()),
  githubUrl: z.string().nullable(),
  itchioUrl: z.string().nullable(),
  steamUrl: z.string().nullable(),
  youtubeUrl: z.string().nullable(),
  author: AuthorSchema,
  status: z.enum(['draft', 'published', 'archived']),
  featured: z.boolean(),
  tags: z.array(TagResponseSchema),
  likesCount: z.number(),
  viewsCount: z.number(),
  isLiked: z.boolean().optional(),
  publishedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export class ProjectResponseDto extends createZodDto(ProjectResponseSchema) {}

// Project list item (without full description)
export const ProjectListItemSchema = ProjectResponseSchema.omit({ description: true })

export class ProjectListItemDto extends createZodDto(ProjectListItemSchema) {}

// Helper to handle empty strings and null as undefined for optional URL fields
const optionalUrl = z.preprocess(
  val => (val === '' || val === null ? undefined : val),
  z.string().url().optional()
)

// Create Project DTO
export const CreateProjectSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be less than 200 characters'),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(100, 'Slug must be less than 100 characters')
    .optional(),
  type: ProjectTypeEnum.default('other'),
  description: z.string().min(1, 'Description is required'),
  shortDescription: z
    .string()
    .max(500, 'Short description must be less than 500 characters')
    .optional(),
  coverImageUrl: optionalUrl,
  galleryUrls: z
    .array(z.string().url())
    .or(z.array(z.string()).transform(urls => urls.filter(url => url !== '')))
    .default([]),
  githubUrl: optionalUrl,
  itchioUrl: optionalUrl,
  steamUrl: optionalUrl,
  youtubeUrl: optionalUrl,
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  featured: z.boolean().default(false),
  tags: z.array(z.string()).default([]), // Tag names
})

export class CreateProjectDto extends createZodDto(CreateProjectSchema) {}

// Update Project DTO
export const UpdateProjectSchema = CreateProjectSchema.partial()

export class UpdateProjectDto extends createZodDto(UpdateProjectSchema) {}

// Query DTOs
export const ProjectQuerySchema = z.object({
  status: z.enum(['draft', 'published', 'archived']).optional(),
  type: ProjectTypeEnum.optional(),
  authorId: z.string().uuid().optional(),
  featured: z.preprocess(val => val === 'true' || val === true, z.boolean()).optional(),
  tags: z.string().optional(), // Comma-separated tag slugs
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  sort: z
    .enum(['createdAt', 'publishedAt', 'likesCount', 'viewsCount', 'title'])
    .default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
})

export class ProjectQueryDto extends createZodDto(ProjectQuerySchema) {}

// Pagination meta
export const PaginationMetaSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  totalPages: z.number(),
  hasNext: z.boolean(),
  hasPrev: z.boolean(),
})

export type ProjectResponse = z.infer<typeof ProjectResponseSchema>
export type ProjectListItem = z.infer<typeof ProjectListItemSchema>
export type PaginationMeta = z.infer<typeof PaginationMetaSchema>
