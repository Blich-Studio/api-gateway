import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as bcrypt from 'bcrypt'
import { randomBytes } from 'crypto'
import { POSTGRES_CLIENT } from '../../database/postgres.module'
import {
  AuthenticationError,
  InvalidCredentialsError,
  EmailNotVerifiedError,
  AuthServiceUnavailableError,
  InvalidAuthResponseError,
  TokenGenerationError,
  MissingConfigurationError,
} from '../../../common/errors'
import { TokenPayload, TokenResponseSchema, User, UserRowSchema } from '../types/auth.types'

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
    private configService: ConfigService,
    @Inject(POSTGRES_CLIENT) private readonly postgresClient: PostgresClient
  ) {
    const jwksTokenEndpoint = this.configService.get<string>('JWKS_TOKEN_ENDPOINT')
    const jwksApiKey = this.configService.get<string>('JWKS_TOKEN_API_KEY')

    if (!jwksTokenEndpoint || !jwksApiKey) {
      throw new MissingConfigurationError('JWKS_TOKEN_ENDPOINT and JWKS_TOKEN_API_KEY')
    }

    this.jwksTokenEndpoint = jwksTokenEndpoint
    this.jwksApiKey = jwksApiKey
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
      name: user.nickname,
      role: user.role,
    })

    // Generate and store refresh token
    const refreshToken = this.generateRefreshToken()
    const refreshTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    try {
      await this.postgresClient.query(
        'UPDATE users SET refresh_token = $1, refresh_token_expires_at = $2 WHERE id = $3',
        [refreshToken, refreshTokenExpiresAt, user.id]
      )
    } catch (error) {
      this.logger.error('Failed to store refresh token', error)
      // Don't fail login if refresh token storage fails, but log it
    }

    return {
      access_token: token,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.nickname,
        // Note: role is NOT included here - client should decode it from the signed JWT token
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

  async refreshToken(refreshToken: string): Promise<{ access_token: string }> {
    if (!refreshToken) {
      throw new AuthenticationError('Refresh token is required')
    }

    // Validate refresh token exists in database
    const result = await this.postgresClient.query(
      'SELECT id FROM users WHERE refresh_token = $1',
      [refreshToken]
    )

    if (result.rowCount === 0) {
      throw new AuthenticationError('Invalid or expired refresh token')
    }

    // Get new access token from JWKS service
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => {
        controller.abort()
      }, 10000)

      const response = await fetch(this.jwksTokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.jwksApiKey,
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new AuthenticationError(`Token service returned ${response.status}`)
      }

      const data = (await response.json()) as Record<string, unknown>
      clearTimeout(timeout)

      if (typeof data.access_token !== 'string' || !data.access_token) {
        throw new InvalidAuthResponseError('Invalid token response from service')
      }

      return { access_token: data.access_token }
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new AuthServiceUnavailableError('Token refresh request timed out')
      }

      throw new AuthServiceUnavailableError('Failed to refresh access token')
    }
  }
}
