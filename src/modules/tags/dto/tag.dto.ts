import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

// Response DTO
export const TagResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export class TagResponseDto extends createZodDto(TagResponseSchema) {}

// Create DTO
export const CreateTagSchema = z.object({
  name: z.string().min(1, 'Name is required').max(30, 'Name must be less than 30 characters'),
  description: z.string().max(200, 'Description must be less than 200 characters').optional(),
})

export class CreateTagDto extends createZodDto(CreateTagSchema) {}

// Update DTO
export const UpdateTagSchema = CreateTagSchema.partial()

export class UpdateTagDto extends createZodDto(UpdateTagSchema) {}

// Query DTO
export const TagQuerySchema = z.object({
  search: z.string().optional(),
})

export class TagQueryDto extends createZodDto(TagQuerySchema) {}

// Types
export type TagResponse = z.infer<typeof TagResponseSchema>
