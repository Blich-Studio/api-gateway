import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { Strategy } from 'passport-custom'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import type { Request } from 'express'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>
  private readonly issuer: string
  private readonly audience: string

  constructor(configService: ConfigService) {
    super()

    const jwksUrl = configService.get<string>('JWKS_URL')
    const issuer = configService.get<string>('JWT_ISSUER')
    const audience = configService.get<string>('JWT_AUDIENCE')

    if (!jwksUrl || !issuer || !audience) {
      throw new Error('Missing required JWT configuration')
    }

    // Create and cache JWKS instance for token verification
    // This avoids fetching JWKS on every request
    this.jwks = createRemoteJWKSet(new URL(jwksUrl))
    this.issuer = issuer
    this.audience = audience
  }

  async validate(req: Request): Promise<unknown> {
    const authHeader = req.headers.authorization

    if (!authHeader?.startsWith('Bearer ')) {
      throw new Error('No auth token')
    }

    const token = authHeader.substring(7)

    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
        audience: this.audience,
      })

      // Validate required fields
      if (
        !payload.sub ||
        typeof payload.sub !== 'string' ||
        !payload.email ||
        typeof payload.email !== 'string'
      ) {
        throw new Error('Invalid token payload')
      }

      return {
        userId: payload.sub,
        email: payload.email,
        name: payload.name as string | undefined,
      }
    } catch (_error) {
      throw new Error('Invalid or expired token')
    }
  }
}
