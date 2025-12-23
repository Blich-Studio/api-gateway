import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

// User roles that can be assigned
export const UserRoleEnum = z.enum(['reader', 'writer', 'admin'])
export type UserRole = z.infer<typeof UserRoleEnum>

// User Response DTO
export const UserResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  nickname: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  role: UserRoleEnum,
  isVerified: z.boolean(),
  avatarUrl: z.string().nullable(),
  createdAt: z.string().datetime(),
  lastLoginAt: z.string().datetime().nullable(),
})

export class UserResponseDto extends createZodDto(UserResponseSchema) {}

// User list item (for admin dashboard)
export const UserListItemSchema = UserResponseSchema

export class UserListItemDto extends createZodDto(UserListItemSchema) {}

// Update User Role DTO (admin only)
export const UpdateUserRoleSchema = z.object({
  role: UserRoleEnum,
})

export class UpdateUserRoleDto extends createZodDto(UpdateUserRoleSchema) {}

// Update User Verification DTO (admin only)
export const UpdateUserVerificationSchema = z.object({
  isVerified: z.boolean(),
})

export class UpdateUserVerificationDto extends createZodDto(UpdateUserVerificationSchema) {}

// Reset Password DTO (admin only - sets a temporary password)
export const ResetPasswordSchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  sendEmail: z.boolean().default(true),
})

export class ResetPasswordDto extends createZodDto(ResetPasswordSchema) {}

// Query DTOs
export const UserQuerySchema = z.object({
  role: UserRoleEnum.optional(),
  isVerified: z.coerce.boolean().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sort: z.enum(['createdAt', 'email', 'nickname', 'lastLoginAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
})

export class UserQueryDto extends createZodDto(UserQuerySchema) {}

// Pagination meta
export const PaginationMetaSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  totalPages: z.number(),
  hasNext: z.boolean(),
  hasPrev: z.boolean(),
})

export type UserResponse = z.infer<typeof UserResponseSchema>
export type UserListItem = z.infer<typeof UserListItemSchema>
export type PaginationMeta = z.infer<typeof PaginationMetaSchema>
