import { Injectable } from '@nestjs/common'
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
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>

  constructor(private configService: ConfigService) {
    const jwksUrl = configService.get<string>('JWKS_URL')
    const issuer = configService.get<string>('JWT_ISSUER')
    const audience = configService.get<string>('JWT_AUDIENCE')

    if (!jwksUrl || !issuer || !audience) {
      throw new Error('Missing required JWT configuration')
    }

    // Create JWKS instance once and cache it
    const jwks = createRemoteJWKSet(new URL(jwksUrl))

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKeyProvider: (_request, rawJwtToken: string, done) => {
        // Verify JWT using cached JWKS
        jwtVerify(rawJwtToken, jwks, {
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

    this.jwks = jwks
  }

  validate(payload: JwtPayload) {
    // Payload is already validated by jwtVerify in secretOrKeyProvider
    // Just transform it to the expected format
    return {
      userId: payload.sub,
      email: payload.email,
      name: payload.name,
    }
  }
}
