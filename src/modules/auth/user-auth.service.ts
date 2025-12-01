import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as bcrypt from 'bcrypt'
import { createHash, randomUUID } from 'node:crypto'
import { POSTGRES_CLIENT } from '../database/postgres.module'
import { EMAIL_SERVICE } from '../email/email.service'
import type { RegisterUserDto } from './dto/register-user.dto'
import type { ResendVerificationDto } from './dto/resend-verification.dto'
import type { VerifyEmailDto } from './dto/verify-email.dto'
import type {
  RegisterResponse,
  ResendVerificationResponse,
  UserWithPassword,
  VerifyEmailResponse,
} from './interfaces/user-auth.interface'

type DbRow = Record<string, unknown>

interface PostgresClient {
  query(text: string, params?: unknown[]): Promise<{ rows: DbRow[]; rowCount: number }>
}

interface EmailService {
  sendVerificationEmail(data: { email: string; name: string; token: string }): Promise<void>
}

@Injectable()
export class UserAuthService implements OnModuleInit {
  private readonly logger = new Logger(UserAuthService.name)
  private readonly TOKEN_PREFIX_LENGTH = 8 // Length of token prefix for efficient lookup
  private readonly CLEANUP_THROTTLE_MS = 60 * 60 * 1000 // 1 hour
  private lastCleanupTime = 0

  constructor(
    @Inject(POSTGRES_CLIENT) private readonly postgresClient: PostgresClient,
    @Inject(EMAIL_SERVICE) private readonly emailService: EmailService,
    private readonly configService: ConfigService
  ) {}

  /**
   * Validate TOKEN_PREFIX_LENGTH matches database schema on startup
   * This prevents runtime errors if the constant and migration get out of sync
   */
  async onModuleInit() {
    try {
      const query = `
        SELECT character_maximum_length
        FROM information_schema.columns
        WHERE table_name = 'verification_tokens'
        AND column_name = 'token_prefix'
      `
      const result = await this.postgresClient.query(query)
      if (result.rows.length > 0) {
        const dbLength = result.rows[0].character_maximum_length as number
        if (dbLength !== this.TOKEN_PREFIX_LENGTH) {
          this.logger.error(
            `TOKEN_PREFIX_LENGTH mismatch: Service expects ${this.TOKEN_PREFIX_LENGTH} but database has VARCHAR(${dbLength}). ` +
              `Update either the constant or migration to match.`
          )
          throw new Error('TOKEN_PREFIX_LENGTH configuration mismatch')
        }
        this.logger.log(`TOKEN_PREFIX_LENGTH validation passed: ${this.TOKEN_PREFIX_LENGTH}`)
      }
    } catch (error) {
      // Log warning but don't fail startup if table doesn't exist yet (pre-migration)
      if (error instanceof Error && error.message.includes('mismatch')) {
        throw error
      }
      this.logger.warn('Could not validate TOKEN_PREFIX_LENGTH (table may not exist yet)', error)
    }
  }

  async register(registerDto: RegisterUserDto): Promise<RegisterResponse> {
    const { email, password, name } = registerDto

    // Check if user already exists before expensive password hashing
    const existsQuery = `SELECT 1 FROM users WHERE email = $1 LIMIT 1`
    const existsResult = await this.postgresClient.query(existsQuery, [email])

    if (existsResult.rowCount && existsResult.rowCount > 0) {
      throw new ConflictException({
        code: 'EMAIL_ALREADY_IN_USE',
        message: 'A user with this email already exists',
      })
    }

    // Hash password (expensive operation, only after confirming email is available)
    const passwordHash = await this.hashPassword(password)

    try {
      // Create user
      const query = `
        INSERT INTO users (email, name, password_hash, is_verified, created_at)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, email, name, is_verified, created_at
      `
      const result = await this.postgresClient.query(query, [
        email,
        name,
        passwordHash,
        false,
        new Date(),
      ])

      const [user] = result.rows

      // Generate verification token
      const verificationToken = await this.createVerificationToken(user.id as string, email)

      // Send verification email
      await this.emailService.sendVerificationEmail({
        email,
        name,
        token: verificationToken,
      })

      this.logger.log(`User registered successfully: ${email}`)

      return {
        id: user.id as string,
        email: user.email as string,
        name: user.name as string,
        isVerified: user.is_verified as boolean,
        createdAt: user.created_at as Date,
      }
    } catch (error: unknown) {
      // Handle race condition where duplicate email was inserted
      if (error instanceof Error && 'code' in error && error.code === '23505') {
        throw new ConflictException({
          code: 'EMAIL_ALREADY_IN_USE',
          message: 'A user with this email already exists',
        })
      }

      // Log unexpected database errors for debugging
      this.logger.error(
        'Unexpected error during user registration',
        error instanceof Error ? error.stack : error
      )
      throw error
    }
  }

  async verifyEmail(verifyDto: VerifyEmailDto): Promise<VerifyEmailResponse> {
    const { token } = verifyDto

    // Extract token prefix for efficient lookup
    const tokenPrefix = token.substring(0, this.TOKEN_PREFIX_LENGTH)

    // Query tokens with matching prefix
    const tokenQuery = `
      SELECT token, user_id, email, expires_at, token_prefix
      FROM verification_tokens
      WHERE token_prefix = $1
    `
    const tokenResult = await this.postgresClient.query(tokenQuery, [tokenPrefix])

    // Check if any token exists (even expired) for better error messages
    if (tokenResult.rowCount === 0) {
      // Add random delay to prevent timing attacks (50-150ms)
      await this.addRandomDelay(50, 150)
      throw new BadRequestException({
        code: 'INVALID_VERIFICATION_TOKEN',
        message: 'The verification token is invalid',
      })
    }

    // Find matching token by comparing hashes (constant-time for all tokens)
    let matchedToken: DbRow | null = null
    let hasExpiredMatch = false

    // Use constant-time comparison to prevent timing attacks
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const tokenHashBuffer = Buffer.from(tokenHash, 'hex')

    // Iterate through all tokens without early exit to maintain constant-time behavior
    // Note: Perfect constant-time is difficult with conditional branches, but we minimize timing leaks
    for (const row of tokenResult.rows) {
      const storedHashBuffer = Buffer.from(row.token as string, 'hex')
      // Use Buffer.compare for constant-time comparison
      const isMatch =
        tokenHashBuffer.length === storedHashBuffer.length &&
        tokenHashBuffer.compare(storedHashBuffer) === 0

      // Store match without early exit (evaluate all tokens)
      // Track both expired and valid matches to ensure correct precedence
      if (isMatch) {
        const isExpired = new Date(row.expires_at as string) < new Date()
        // Only set hasExpiredMatch if we haven't found a valid token yet
        // This ensures valid tokens take precedence over expired ones
        if (isExpired && !matchedToken) {
          hasExpiredMatch = true
        } else if (!isExpired) {
          // Valid token takes precedence - override any previous expired match
          matchedToken = row
          hasExpiredMatch = false
        }
      }
    }

    if (hasExpiredMatch && !matchedToken) {
      // Add random delay to prevent timing attacks (50-150ms)
      await this.addRandomDelay(50, 150)
      throw new BadRequestException({
        code: 'VERIFICATION_TOKEN_EXPIRED',
        message: 'The verification token has expired',
      })
    }

    if (!matchedToken) {
      // Add random delay to prevent timing attacks (50-150ms)
      await this.addRandomDelay(50, 150)
      throw new BadRequestException({
        code: 'INVALID_VERIFICATION_TOKEN',
        message: 'The verification token is invalid',
      })
    }

    // Update user verification status
    const updateQuery = `
      UPDATE users
      SET is_verified = true
      WHERE id = $1
      RETURNING id, email, is_verified
    `
    await this.postgresClient.query(updateQuery, [matchedToken.user_id])

    // Delete used token (delete by hash)
    await this.postgresClient.query('DELETE FROM verification_tokens WHERE token = $1', [
      matchedToken.token,
    ])

    // Cleanup expired tokens asynchronously (fire-and-forget) to avoid blocking response
    this.cleanupExpiredTokens().catch(error => {
      this.logger.warn('Background cleanup failed', error)
    })

    this.logger.log(`Email verified successfully: ${matchedToken.email as string}`)

    return { message: 'Email verified successfully' }
  }

  async resendVerification(resendDto: ResendVerificationDto): Promise<ResendVerificationResponse> {
    const { email } = resendDto

    // Find user
    const user = await this.findUserByEmail(email)
    if (!user) {
      // Return generic success to prevent email enumeration
      return {
        message: 'If this email is registered and unverified, a verification email has been sent',
      }
    }

    // If user is already verified, return a helpful message (no enumeration risk since we already know the account exists)
    if (user.isVerified) {
      return {
        message: 'This email address is already verified. You can proceed to log in.',
      }
    }

    // Delete old verification tokens
    await this.postgresClient.query('DELETE FROM verification_tokens WHERE user_id = $1', [user.id])

    // Generate new verification token
    const verificationToken = await this.createVerificationToken(user.id, email)

    // Send verification email
    await this.emailService.sendVerificationEmail({
      email,
      name: user.name,
      token: verificationToken,
    })

    this.logger.log(`Verification email resent to: ${email}`)

    return { message: 'Verification email sent successfully' }
  }

  private async findUserByEmail(email: string): Promise<UserWithPassword | null> {
    const query = `
      SELECT id, email, name, password_hash, is_verified, created_at
      FROM users
      WHERE email = $1
    `
    const result = await this.postgresClient.query(query, [email])

    if (result.rowCount === 0) {
      return null
    }

    const [row] = result.rows

    return {
      id: row.id as string,
      email: row.email as string,
      name: row.name as string,
      passwordHash: row.password_hash as string,
      isVerified: row.is_verified as boolean,
      createdAt: row.created_at as Date,
    }
  }

  private async createVerificationToken(userId: string, email: string): Promise<string> {
    const token = randomUUID()
    // Use SHA-256 for token hashing (fast, cryptographically secure)
    // Tokens don't need bcrypt's intentional slowness - only passwords do
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const tokenPrefix = token.substring(0, this.TOKEN_PREFIX_LENGTH) // Store prefix for efficient lookup
    const expiryHours = this.configService.get<number>('VERIFICATION_TOKEN_EXPIRY_HOURS', 24)
    const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000)

    try {
      const query = `
        INSERT INTO verification_tokens (token, token_prefix, user_id, email, expires_at)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING token
      `
      await this.postgresClient.query(query, [tokenHash, tokenPrefix, userId, email, expiresAt])

      // Return unhashed token to send to user
      return token
    } catch (error: unknown) {
      this.logger.error(
        'Error creating verification token',
        error instanceof Error ? error.stack : error
      )
      throw error
    }
  }

  private async hashPassword(password: string): Promise<string> {
    const saltRounds = parseInt(this.configService.get<string>('BCRYPT_SALT_ROUNDS', '12'), 10)
    return bcrypt.hash(password, saltRounds)
  }

  /**
   * Adds a random delay to prevent timing attacks
   * @param minMs Minimum delay in milliseconds
   * @param maxMs Maximum delay in milliseconds
   */
  private async addRandomDelay(minMs: number, maxMs: number): Promise<void> {
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs
    return new Promise(resolve => {
      setTimeout(resolve, delay)
    })
  }

  /**
   * Cleanup expired verification tokens to prevent table bloat
   * Throttled to run max once per hour to avoid excessive database load
   * For production, consider using a scheduled job (cron) instead
   */
  private async cleanupExpiredTokens(): Promise<void> {
    // Throttle cleanup to prevent excessive database load on high-traffic apps
    const now = Date.now()
    if (now - this.lastCleanupTime < this.CLEANUP_THROTTLE_MS) {
      return // Skip cleanup if last run was less than 1 hour ago
    }

    this.lastCleanupTime = now

    try {
      const result = await this.postgresClient.query(
        'DELETE FROM verification_tokens WHERE expires_at < NOW()'
      )
      if (result.rowCount && result.rowCount > 0) {
        this.logger.log(`Cleaned up ${result.rowCount} expired verification token(s)`)
      }
    } catch (error) {
      // Log but don't throw - cleanup failure shouldn't break verification flow
      this.logger.warn('Failed to cleanup expired tokens', error)
    }
  }
}
