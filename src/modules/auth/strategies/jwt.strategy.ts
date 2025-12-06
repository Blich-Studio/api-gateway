import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { Strategy, ExtractJwt } from 'passport-jwt'
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'

interface JwtPayload extends JWTPayload {
  sub: string
  email: string
  name?: string
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private jwksUrl: string
  private issuer: string
  private audience: string

  constructor(private configService: ConfigService) {
    const jwksUrl = configService.get<string>('JWKS_URL')
    const issuer = configService.get<string>('JWT_ISSUER')
    const audience = configService.get<string>('JWT_AUDIENCE')

    if (!jwksUrl || !issuer || !audience) {
      throw new Error('Missing required JWT configuration')
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKeyProvider: (_request, rawJwtToken: string, done) => {
        // Verify JWT using JWKS
        const JWKS = createRemoteJWKSet(new URL(jwksUrl))
        jwtVerify(rawJwtToken, JWKS, {
          issuer,
          audience,
        })
          .then(({ payload }) => {
            // Pass the validated payload to passport
            done(null, payload as never)
          })
          .catch((error: Error) => {
            done(error, undefined as never)
          })
      },
    })

    this.jwksUrl = jwksUrl
    this.issuer = issuer
    this.audience = audience
  }

  validate(payload: JwtPayload) {
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid token')
    }

    return {
      userId: payload.sub,
      email: payload.email,
      name: payload.name,
    }
  }
}
