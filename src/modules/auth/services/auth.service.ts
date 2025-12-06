import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as bcrypt from 'bcrypt'
import { POSTGRES_CLIENT } from '../../database/postgres.module'

interface TokenPayload {
  sub: string
  email: string
  name: string
  role: 'admin' | 'writer' | 'reader'
}

interface TokenResponse {
  token: string
}

interface User {
  id: string
  email: string
  name: string
  password_hash: string
  is_verified: boolean
}

type DbRow = Record<string, unknown>

interface PostgresClient {
  query(text: string, params?: unknown[]): Promise<{ rows: DbRow[]; rowCount: number }>
}

@Injectable()
export class AuthService {
  private jwksTokenEndpoint: string
  private jwksApiKey: string

  constructor(
    private configService: ConfigService,
    @Inject(POSTGRES_CLIENT) private readonly postgresClient: PostgresClient
  ) {
    const jwksTokenEndpoint = this.configService.get<string>('JWKS_TOKEN_ENDPOINT')
    const jwksApiKey = this.configService.get<string>('JWKS_TOKEN_API_KEY')

    if (!jwksTokenEndpoint || !jwksApiKey) {
      throw new Error(
        'Missing JWKS configuration. Set JWKS_TOKEN_ENDPOINT and JWKS_TOKEN_API_KEY environment variables.'
      )
    }

    this.jwksTokenEndpoint = jwksTokenEndpoint
    this.jwksApiKey = jwksApiKey
  }

  async login(email: string, password: string) {
    // Validate credentials against database
    const user = await this.validateUser(email, password)

    if (!user) {
      throw new UnauthorizedException('Invalid credentials')
    }

    // Check if user's email is verified
    if (!user.is_verified) {
      throw new UnauthorizedException('Please verify your email before logging in')
    }

    // Request token from JWKS service
    const token = await this.issueToken({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: 'reader', // Default role, can be enhanced later
    })

    return {
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    }
  }

  private async validateUser(email: string, password: string): Promise<User | null> {
    const query = `
      SELECT id, email, name, password_hash, is_verified
      FROM users
      WHERE email = $1
      LIMIT 1
    `
    const result = await this.postgresClient.query(query, [email])

    if (!result.rowCount || result.rowCount === 0) {
      return null
    }

    const [row] = result.rows
    const user: User = {
      id: row.id as string,
      email: row.email as string,
      name: row.name as string,
      password_hash: row.password_hash as string,
      is_verified: row.is_verified as boolean,
    }

    // Verify password with bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password_hash)

    if (!isPasswordValid) {
      return null
    }

    return user
  }

  private async issueToken(payload: TokenPayload): Promise<string> {
    try {
      const response = await fetch(this.jwksTokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.jwksApiKey,
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error(`JWKS service error: ${response.statusText}`)
      }

      const data = (await response.json()) as TokenResponse
      return data.token
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Failed to issue token: ${message}`)
    }
  }

  refreshToken(_userId: string): Promise<never> {
    // TODO: Implement token refresh logic
    // Verify refresh token and issue new access token
    return Promise.reject(new Error('Not implemented'))
  }
}
