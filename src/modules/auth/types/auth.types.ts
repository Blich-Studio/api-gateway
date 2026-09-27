import { z } from 'zod'

/**
 * Zod schema for validating user row from database
 */
export const UserRowSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  nickname: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  passwordHash: z.string(),
  isVerified: z.boolean(),
  role: z.enum(['reader', 'writer', 'admin']),
})

/**
 * Zod schema for validating token response from JWKS service
 */
export const TokenResponseSchema = z.object({
  token: z.string().min(1),
})

/**
 * User type inferred from database schema
 */
export type User = z.infer<typeof UserRowSchema>

export const UserProfileSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  role: z.enum(['reader', 'writer', 'admin']),
})

export type UserProfile = z.infer<typeof UserProfileSchema>

export const RefreshUserRowSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  nickname: z.string().nullable(),
  role: z.enum(['reader', 'writer', 'admin']),
  is_verified: z.literal(true),
  refresh_token_expires_at: z.coerce.date(),
})

/**
 * JWT token payload structure (matches JWKS service schema)
 */
export interface TokenPayload {
  sub: string
  email: string
  displayName?: string
  role: 'admin' | 'writer' | 'reader'
}
