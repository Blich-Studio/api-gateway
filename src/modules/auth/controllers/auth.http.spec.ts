import { Controller, Get, UseGuards, type INestApplication } from '@nestjs/common'
import { OptionalJwtAuthGuard } from '../guards/optional-jwt-auth.guard'
import { APP_GUARD } from '@nestjs/core'
import { Test } from '@nestjs/testing'
import { PassportModule } from '@nestjs/passport'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { createServer, type Server } from 'node:http'
import { type AddressInfo } from 'node:net'
import { setTimeout as delay } from 'node:timers/promises'
import { exportJWK, generateKeyPair, SignJWT } from 'jose'
import { ZodValidationPipe } from 'nestjs-zod'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { AuthController } from './auth.controller'
import { AuthService } from '../services/auth.service'
import { JwtStrategy } from '../strategies/jwt.strategy'
import { AppConfigService } from '../../../common/config'
import { POSTGRES_CLIENT } from '../../database/postgres.module'

@Controller('optional')
class OptionalReadController {
  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  read() { return { success: true } }
}

describe('Authentication HTTP boundaries', () => {
  let app: INestApplication
  let jwksServer: Server
  let validToken: string
  let expiredToken: string
  const userId = '550e8400-e29b-41d4-a716-446655440000'
  const db = { query: vi.fn() }
  const profile = {
    userId,
    email: 'current@example.com',
    name: 'Current name',
    role: 'reader'
  }

  beforeAll(async () => {
    const { privateKey, publicKey } = await generateKeyPair('RS256')
    const jwk = { ...(await exportJWK(publicKey)), kid: 'test-key' }
    jwksServer = createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ keys: [jwk] }))
    })
    await new Promise<void>((resolve) => jwksServer.listen(0, '127.0.0.1', resolve))
    const issuer = `http://127.0.0.1:${(jwksServer.address() as AddressInfo).port}`
    const sign = (expires: string | number) =>
      new SignJWT({
        email: 'old@example.com',
        role: 'admin',
        displayName: 'Old name'
      })
        .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
        .setSubject(userId)
        .setIssuer(issuer)
        .setAudience('test-api')
        .setExpirationTime(expires)
        .sign(privateKey)
    validToken = await sign('5m')
    expiredToken = await sign(Math.floor(Date.now() / 1000) - 10)
    const module = await Test.createTestingModule({
      imports: [PassportModule, ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])],
      controllers: [AuthController, OptionalReadController],
      providers: [
        AuthService,
        JwtStrategy,
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: POSTGRES_CLIENT, useValue: db },
        {
          provide: AppConfigService,
          useValue: {
            jwksUrl: issuer,
            jwtIssuer: issuer,
            jwtAudience: 'test-api',
            jwksTokenEndpoint: `${issuer}/token`,
            jwksTokenApiKey: 'test-key'
          }
        }
      ]
    }).compile()
    app = module.createNestApplication({ logger: false })
    app.useGlobalPipes(new ZodValidationPipe())
    await app.init()
  })

  afterAll(async () => {
    await app?.close()
    if (jwksServer)
      await new Promise<void>((resolve, reject) =>
        jwksServer.close((error) => (error ? reject(error) : resolve()))
      )
  })

  it.each([undefined, 'Bearer malformed', () => `Bearer ${expiredToken}`])(
    'returns the project 401 response for absent, malformed or expired credentials (%s)',
    async (credential) => {
      const req = request(app.getHttpServer()).get('/auth/me')
      const authorization = typeof credential === 'function' ? credential() : credential
      if (authorization) req.set('Authorization', authorization)
      const response = await req.expect(401)
      expect(response.body).toMatchObject({
        code: 'AUTHENTICATION_ERROR',
        statusCode: 401
      })
    }
  )

  it('allows anonymous reads but requests refresh for expired optional credentials', async () => {
    await request(app.getHttpServer()).get('/optional').expect(200)
    await request(app.getHttpServer()).get('/optional').auth(validToken, { type: 'bearer' }).expect(200)
    await request(app.getHttpServer()).get('/optional').auth(expiredToken, { type: 'bearer' }).expect(401)
    await request(app.getHttpServer()).get('/optional').set('Authorization', 'Bearer malformed').expect(401)
  })

  it('returns the current database identity and role rather than stale privileged JWT claims', async () => {
    db.query.mockResolvedValueOnce({ rows: [profile], rowCount: 1 })
    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .auth(validToken, { type: 'bearer' })
      .expect(200)
    expect(response.body).toEqual(profile)
    expect(db.query).toHaveBeenLastCalledWith(
      expect.stringContaining('WHERE id = $1 AND is_verified = TRUE'),
      [userId]
    )
  })

  it('rejects an authenticated subject whose verified account is unavailable', async () => {
    db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 })
    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .auth(validToken, { type: 'bearer' })
      .expect(401)
    expect(response.body.code).toBe('AUTHENTICATION_ERROR')
  })

  it('can revoke a refresh token without a current access token and rejects a missing token', async () => {
    db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 })
    await request(app.getHttpServer())
      .post('/auth/logout')
      .send({ refreshToken: 'old-refresh' })
      .expect(200, { success: true })
    expect(db.query).toHaveBeenLastCalledWith(
      expect.stringContaining('WHERE refresh_token = $1'),
      ['old-refresh']
    )
    await request(app.getHttpServer()).post('/auth/logout').send({}).expect(400)
  })

  it.each([
    { route: 'login', limit: 5 },
    { route: 'refresh', limit: 10 }
  ])(
    'throttles /auth/$route for a minute rather than milliseconds',
    async ({ route, limit }) => {
      for (let attempt = 0; attempt < limit; attempt += 1) {
        await request(app.getHttpServer()).post(`/auth/${route}`).send({}).expect(400)
      }
      await delay(100)
      const response = await request(app.getHttpServer())
        .post(`/auth/${route}`)
        .send({})
        .expect(429)
      expect(Number(response.headers['retry-after'])).toBeGreaterThan(50)
    }
  )
})
