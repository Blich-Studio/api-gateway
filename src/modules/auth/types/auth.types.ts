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

/**
 * JWT token payload structure
 */
export interface TokenPayload {
  sub: string
  email: string
  name: string
  role: 'admin' | 'writer' | 'reader'
}
