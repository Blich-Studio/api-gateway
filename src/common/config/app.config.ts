/**
 * Application configuration constants with defaults
 * Centralizes configuration values to avoid duplication
 */

export const AppConfig = {
  // Authentication
  BCRYPT_SALT_ROUNDS: 12,

  // Email verification
  VERIFICATION_TOKEN_EXPIRY_HOURS: 24,
  TOKEN_PREFIX_LENGTH: 8,

  // Security - Timing attack prevention
  TIMING_ATTACK_MIN_DELAY_MS: 50,
  TIMING_ATTACK_MAX_DELAY_MS: 150,

  // Cleanup
  TOKEN_CLEANUP_THROTTLE_MS: 60 * 60 * 1000, // 1 hour

  // Rate limiting
  RATE_LIMIT_TTL: 60000, // 60 seconds
  RATE_LIMIT_DEFAULT: 10,
  RATE_LIMIT_LOGIN: 5,
  RATE_LIMIT_REGISTER: 5,
  RATE_LIMIT_RESEND_VERIFICATION: 3,
} as const
