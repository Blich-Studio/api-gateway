/**
 * Standardized error codes for consistent error handling across the application
 */

export const ErrorCodes = {
  // Authentication errors
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',

  // User registration errors
  EMAIL_ALREADY_IN_USE: 'EMAIL_ALREADY_IN_USE',

  // Email verification errors
  INVALID_VERIFICATION_TOKEN: 'INVALID_VERIFICATION_TOKEN',
  VERIFICATION_TOKEN_EXPIRED: 'VERIFICATION_TOKEN_EXPIRED',

  // General errors
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
} as const

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes]

/**
 * Error messages corresponding to error codes
 */
export const ErrorMessages: Record<ErrorCode, string> = {
  [ErrorCodes.INVALID_CREDENTIALS]: 'Invalid credentials',
  [ErrorCodes.EMAIL_NOT_VERIFIED]: 'Please verify your email before logging in',
  [ErrorCodes.EMAIL_ALREADY_IN_USE]: 'A user with this email already exists',
  [ErrorCodes.INVALID_VERIFICATION_TOKEN]: 'The verification token is invalid',
  [ErrorCodes.VERIFICATION_TOKEN_EXPIRED]: 'The verification token has expired',
  [ErrorCodes.INTERNAL_SERVER_ERROR]: 'An unexpected error occurred',
}
