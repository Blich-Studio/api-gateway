import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

// Activity types
export const ActivityTypeEnum = z.enum([
  'comment_created',
  'comment_replied',
  'article_created',
  'article_published',
  'article_liked',
  'project_created',
  'project_liked',
  'user_registered',
  'user_verified',
])

export type ActivityType = z.infer<typeof ActivityTypeEnum>

// Activity Response DTO
export const ActivityResponseSchema = z.object({
  id: z.string(),
  type: ActivityTypeEnum,
  message: z.string(),
  actor: z.object({
    id: z.string().uuid(),
    displayName: z.string(),
    avatarUrl: z.string().nullable(),
  }),
  target: z
    .object({
      type: z.enum(['article', 'project', 'comment', 'user']),
      id: z.string(),
      title: z.string().optional(),
      slug: z.string().optional(),
    })
    .optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.string().datetime(),
})

export class ActivityResponseDto extends createZodDto(ActivityResponseSchema) {}

// Activity Query DTO
export const ActivityQuerySchema = z.object({
  type: ActivityTypeEnum.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export class ActivityQueryDto extends createZodDto(ActivityQuerySchema) {}

// Activity Stats DTO
export const ActivityStatsSchema = z.object({
  totalComments: z.number(),
  pendingComments: z.number(),
  totalArticles: z.number(),
  publishedArticles: z.number(),
  totalUsers: z.number(),
  newUsersToday: z.number(),
  totalLikes: z.number(),
})

export class ActivityStatsDto extends createZodDto(ActivityStatsSchema) {}

export type ActivityResponse = z.infer<typeof ActivityResponseSchema>
export type ActivityQuery = z.infer<typeof ActivityQuerySchema>
export type ActivityStats = z.infer<typeof ActivityStatsSchema>
