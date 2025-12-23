import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

// User info embedded in comment response
export const CommentUserSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
})

// Base comment schema without replies (to avoid circular reference issues)
const BaseCommentSchema = z.object({
  id: z.string().uuid(),
  content: z.string(),
  user: CommentUserSchema,
  userId: z.string().uuid(),
  articleId: z.string().uuid().nullable(),
  projectId: z.string().uuid().nullable(),
  parentId: z.string().uuid().nullable(),
  status: z.enum(['pending', 'approved', 'rejected', 'spam']),
  likesCount: z.number(),
  isLiked: z.boolean().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

// Comment Response DTO with optional replies
export const CommentResponseSchema: z.ZodType<
  z.infer<typeof BaseCommentSchema> & { replies?: Array<z.infer<typeof BaseCommentSchema>> }
> = BaseCommentSchema.extend({
  replies: z.array(z.lazy(() => BaseCommentSchema)).optional(),
})

export class CommentResponseDto extends createZodDto(CommentResponseSchema) {}

// Create Comment DTO
export const CreateCommentSchema = z
  .object({
    content: z
      .string()
      .min(1, 'Content is required')
      .max(1000, 'Content must be less than 1000 characters'),
    articleId: z.string().uuid().optional(),
    projectId: z.string().uuid().optional(),
    parentId: z.string().uuid().optional(),
  })
  .refine(data => (data.articleId && !data.projectId) ?? (!data.articleId && data.projectId), {
    message: 'Either articleId or projectId must be provided, but not both',
  })

export class CreateCommentDto extends createZodDto(CreateCommentSchema) {}

// Update Comment DTO
export const UpdateCommentSchema = z.object({
  content: z
    .string()
    .min(1, 'Content is required')
    .max(1000, 'Content must be less than 1000 characters')
    .optional(),
  status: z.enum(['pending', 'approved', 'rejected', 'spam']).optional(),
})

export class UpdateCommentDto extends createZodDto(UpdateCommentSchema) {}

// Query DTOs
export const CommentQuerySchema = z.object({
  articleId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  status: z.enum(['pending', 'approved', 'rejected', 'spam']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
})

export class CommentQueryDto extends createZodDto(CommentQuerySchema) {}

// Pagination meta
export const PaginationMetaSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  totalPages: z.number(),
  hasNext: z.boolean(),
  hasPrev: z.boolean(),
})

export type CommentResponse = z.infer<typeof CommentResponseSchema>
export type PaginationMeta = z.infer<typeof PaginationMetaSchema>
