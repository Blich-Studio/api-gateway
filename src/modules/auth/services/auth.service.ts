import { Inject, Injectable, Logger } from '@nestjs/common'
import * as bcrypt from 'bcrypt'
import { randomBytes } from 'crypto'
import { AppConfigService } from '../../../common/config'
import { POSTGRES_CLIENT } from '../../database/postgres.module'
import {
  AuthenticationError,
  InvalidCredentialsError,
  EmailNotVerifiedError,
  AuthServiceUnavailableError,
  InvalidAuthResponseError,
  TokenGenerationError,
  MissingConfigurationError,
  DatabaseError,
} from '../../../common/errors'
import {
  RefreshUserRowSchema,
  TokenPayload,
  TokenResponseSchema,
  User,
  UserProfile,
  UserProfileSchema,
  UserRowSchema,
} from '../types/auth.types'

type DbRow = Record<string, unknown>

interface PostgresClient {
  query(text: string, params?: unknown[]): Promise<{ rows: DbRow[]; rowCount: number }>
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)
  private jwksTokenEndpoint: string
  private jwksApiKey: string

  constructor(
    private readonly appConfig: AppConfigService,
    @Inject(POSTGRES_CLIENT) private readonly postgresClient: PostgresClient
  ) {
    const { jwksTokenEndpoint, jwksTokenApiKey } = this.appConfig

    if (!jwksTokenEndpoint || !jwksTokenApiKey) {
      throw new MissingConfigurationError('JWKS_TOKEN_ENDPOINT and JWKS_TOKEN_API_KEY')
    }

    this.jwksTokenEndpoint = jwksTokenEndpoint
    this.jwksApiKey = jwksTokenApiKey
  }

  async login(email: string, password: string) {
    const user = await this.validateUser(email, password)

    if (!user) {
      throw new InvalidCredentialsError()
    }

    if (!user.isVerified) {
      throw new EmailNotVerifiedError()
    }
    const token = await this.issueToken({
      sub: user.id,
      email: user.email,
      displayName: user.nickname,
      role: user.role,
    })

    // Generate and store refresh token
    const refreshToken = this.generateRefreshToken()
    const refreshTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    // Note: the current schema supports one refresh session per user. The condition
    // prevents an in-flight login restoring access after a password or role change.
    let stored: { rowCount: number }
    try {
      stored = await this.postgresClient.query(
        `UPDATE users SET refresh_token = $1, refresh_token_expires_at = $2, last_login_at = NOW()
         WHERE id = $3 AND password_hash = $4 AND is_verified = TRUE AND role = $5`,
        [refreshToken, refreshTokenExpiresAt, user.id, user.passwordHash, user.role]
      )
    } catch (error) {
      this.logger.error('Failed to store refresh token', error)
      throw new DatabaseError('Unable to create session')
    }

    if (stored.rowCount !== 1) {
      throw new AuthenticationError('Account changed during login; please sign in again')
    }

    return {
      access_token: token,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.nickname,
        // Clients obtain their current role from /auth/me; JWTs stay in HttpOnly cookies.
      },
    }
  }

  private async validateUser(email: string, password: string): Promise<User | null> {
    const query = `
      SELECT 
        id, 
        email, 
        nickname,
        first_name as "firstName",
        last_name as "lastName",
        password_hash as "passwordHash",
        is_verified as "isVerified",
        role
      FROM users
      WHERE email = $1
    `
    const result = await this.postgresClient.query(query, [email])

    // Always hash the password even if user not found to prevent timing attacks
    // Use a realistic bcrypt hash to avoid fingerprinting
    const dummyHash = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5jtRPZsLqzXrK' // bcrypt hash of 'dummy'
    const userExists = result.rowCount && result.rowCount > 0

    if (!userExists) {
      // Run bcrypt comparison with dummy hash to maintain constant time
      await bcrypt.compare(password, dummyHash)
      return null
    }

    const [row] = result.rows

    // Validate database row structure at runtime
    const parseResult = UserRowSchema.safeParse(row)
    if (!parseResult.success) {
      this.logger.error(
        `Invalid user data from database: ${parseResult.error.message}`,
        'validateUser'
      )
      return null
    }

    const user = parseResult.data

    // Verify password with bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash)

    if (!isPasswordValid) {
      return null
    }

    return user
  }

  private async issueToken(payload: TokenPayload): Promise<string> {
    const controller = new AbortController()
    const timeout = setTimeout(() => {
      controller.abort()
    }, 5000) // 5 second timeout

    try {
      const response = await fetch(this.jwksTokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.jwksApiKey,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })

      if (!response.ok) {
        // Log error category server-side, return generic error to client
        const errorCategory = response.status >= 500 ? 'service_error' : 'client_error'
        this.logger.error(
          `JWKS service error: status=${response.status}, category=${errorCategory}`,
          'issueToken'
        )

        // Provide slightly more context based on status code
        if (response.status >= 500) {
          throw new AuthServiceUnavailableError()
        }
        throw new TokenGenerationError()
      }

      // Validate content-type header
      const contentType = response.headers.get('content-type')
      if (!contentType?.includes('application/json')) {
        this.logger.error(`JWKS service returned non-JSON response: ${contentType}`, 'issueToken')
        throw new InvalidAuthResponseError()
      }

      // Parse and validate JSON response
      let jsonData: unknown
      try {
        jsonData = await response.json()
      } catch (error) {
        this.logger.error(
          `Failed to parse JWKS service response: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'issueToken'
        )
        throw new InvalidAuthResponseError()
      }

      // Validate response structure
      const parseResult = TokenResponseSchema.safeParse(jsonData)
      if (!parseResult.success) {
        this.logger.error(
          `Invalid token response structure: ${parseResult.error.message}`,
          'issueToken'
        )
        throw new InvalidAuthResponseError()
      }

      return parseResult.data.token
    } catch (error) {
      // Log detailed error server-side
      if (error instanceof Error) {
        this.logger.error(`Token issuance failed: ${error.message}`, error.stack, 'issueToken')
      }

      // Return generic error to client
      if (
        error instanceof InvalidCredentialsError ||
        error instanceof EmailNotVerifiedError ||
        error instanceof AuthServiceUnavailableError ||
        error instanceof InvalidAuthResponseError ||
        error instanceof TokenGenerationError
      ) {
        throw error
      }

      // Check if it's a timeout/network error
      if (error instanceof Error && error.name === 'AbortError') {
        throw new AuthServiceUnavailableError('Authentication service request timed out')
      }

      throw new AuthServiceUnavailableError()
    } finally {
      clearTimeout(timeout)
    }
  }

  private generateRefreshToken(): string {
    // Generate a secure random token (32 bytes = 256 bits)
    return randomBytes(32).toString('hex')
  }

  async getProfile(userId: string): Promise<UserProfile> {
    const result = await this.postgresClient.query(
      `SELECT id AS "userId", email, COALESCE(nickname, first_name, email) AS name, role
       FROM users WHERE id = $1 AND is_verified = TRUE`,
      [userId]
    )
    const profile = UserProfileSchema.safeParse(result.rows[0])
    if (!profile.success) {
      throw new AuthenticationError('Account is unavailable')
    }
    return profile.data
  }

  async logout(refreshToken: string): Promise<{ success: true }> {
    await this.postgresClient.query(
      `UPDATE users SET refresh_token = NULL, refresh_token_expires_at = NULL
       WHERE refresh_token = $1`,
      [refreshToken]
    )
    // Access JWTs remain valid until their short expiry. This revokes renewal.
    return { success: true }
  }

  async refreshToken(
    refreshToken: string
  ): Promise<{ access_token: string; refresh_token: string }> {
    if (!refreshToken) {
      throw new AuthenticationError('Refresh token is required')
    }

    // Validate refresh token exists in database and get user info for new token
    const result = await this.postgresClient.query(
      `SELECT id, email, nickname, role, is_verified, refresh_token_expires_at
       FROM users
       WHERE refresh_token = $1`,
      [refreshToken]
    )

    if (result.rowCount === 0) {
      throw new AuthenticationError('Invalid or expired refresh token')
    }

    const parsedUser = RefreshUserRowSchema.safeParse(result.rows[0])
    if (!parsedUser.success) {
      throw new AuthenticationError('Invalid or expired refresh token')
    }
    const user = parsedUser.data

    // Check if refresh token has expired
    if (user.refresh_token_expires_at.getTime() <= Date.now()) {
      throw new AuthenticationError('Refresh token has expired')
    }

    // Issue new access token using user's claims
    const newAccessToken = await this.issueToken({
      sub: user.id,
      email: user.email,
      displayName: user.nickname ?? undefined,
      role: user.role,
    })

    // Rotate refresh token — invalidate old token and issue a new one
    const newRefreshToken = this.generateRefreshToken()
    const refreshTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    // The database compare-and-swap allows exactly one use across application
    // instances and cannot restore a token revoked while the issuer was running.
    let rotated: { rowCount: number }
    try {
      rotated = await this.postgresClient.query(
        `UPDATE users SET refresh_token = $1, refresh_token_expires_at = $2
         WHERE id = $3 AND refresh_token = $4 AND is_verified = TRUE
           AND refresh_token_expires_at > NOW() AND role = $5`,
        [newRefreshToken, refreshTokenExpiresAt, user.id, refreshToken, user.role]
      )
    } catch (error) {
      this.logger.error('Failed to rotate refresh token', error)
      throw new DatabaseError('Unable to renew session')
    }
    if (rotated.rowCount !== 1) {
      throw new AuthenticationError('Invalid or expired refresh token')
    }

    return { access_token: newAccessToken, refresh_token: newRefreshToken }
  }
}
