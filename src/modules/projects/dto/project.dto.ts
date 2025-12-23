import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { TagResponseSchema } from '../../tags/dto/tag.dto'

// Author info embedded in project response
export const AuthorSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
})

// Project Response DTO
export const ProjectResponseSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  slug: z.string(),
  description: z.string(),
  shortDescription: z.string().nullable(),
  coverImageUrl: z.string().nullable(),
  galleryUrls: z.array(z.string()),
  videoUrl: z.string().nullable(),
  externalUrl: z.string().nullable(),
  githubUrl: z.string().nullable(),
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

// Create Project DTO
export const CreateProjectSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be less than 200 characters'),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(100, 'Slug must be less than 100 characters')
    .optional(),
  description: z.string().min(1, 'Description is required'),
  shortDescription: z
    .string()
    .max(500, 'Short description must be less than 500 characters')
    .optional(),
  coverImageUrl: z.string().url().optional(),
  galleryUrls: z.array(z.string().url()).default([]),
  videoUrl: z.string().url().optional(),
  externalUrl: z.string().url().optional(),
  githubUrl: z.string().url().optional(),
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
