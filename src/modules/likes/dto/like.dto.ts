import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

// Like Response DTO
export const LikeResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  articleId: z.string().uuid().nullable(),
  projectId: z.string().uuid().nullable(),
  commentId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
})

export class LikeResponseDto extends createZodDto(LikeResponseSchema) {}

// Like Target DTO (for liking/unliking)
export const LikeTargetSchema = z
  .object({
    articleId: z.string().uuid().optional(),
    projectId: z.string().uuid().optional(),
    commentId: z.string().uuid().optional(),
  })
  .refine(
    data => {
      const targets = [data.articleId, data.projectId, data.commentId].filter(Boolean)
      return targets.length === 1
    },
    { message: 'Exactly one of articleId, projectId, or commentId must be provided' }
  )

export class LikeTargetDto extends createZodDto(LikeTargetSchema) {}

// Like status response
export const LikeStatusSchema = z.object({
  isLiked: z.boolean(),
  likesCount: z.number(),
})

export class LikeStatusDto extends createZodDto(LikeStatusSchema) {}

export type LikeResponse = z.infer<typeof LikeResponseSchema>
export type LikeStatus = z.infer<typeof LikeStatusSchema>
