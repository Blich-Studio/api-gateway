import { Test } from '@nestjs/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthService } from './auth.service'
import { AppConfigService } from '../../../common/config'
import { POSTGRES_CLIENT } from '../../database/postgres.module'
import { UsersService } from '../../users/users.service'
import { EMAIL_SERVICE } from '../../email/email.service'

vi.mock('bcrypt', () => ({
  hash: vi.fn(async () => 'new-password-hash'),
  compare: vi.fn(async () => true)
}))

describe('Session lifetime and rotation', () => {
  let service: AuthService
  let usersService: UsersService
  let storedToken: string | null
  const user = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'reader@example.com',
    nickname: 'Reader',
    role: 'reader',
    is_verified: true,
    refresh_token_expires_at: new Date(Date.now() + 86_400_000),
    created_at: new Date()
  }
  const db = { query: vi.fn() }
  const issuer = vi.fn()

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  beforeEach(async () => {
    vi.resetAllMocks()
    storedToken = 'original-refresh'
    vi.stubGlobal('fetch', issuer)
    issuer.mockResolvedValue(
      new Response(JSON.stringify({ token: 'access-token' }), {
        headers: { 'content-type': 'application/json' }
      })
    )
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        UsersService,
        { provide: POSTGRES_CLIENT, useValue: db },
        { provide: EMAIL_SERVICE, useValue: { sendEmail: vi.fn() } },
        {
          provide: AppConfigService,
          useValue: {
            jwksTokenEndpoint: 'http://issuer.invalid/token',
            jwksTokenApiKey: 'test-key'
          }
        }
      ]
    }).compile()
    service = module.get(AuthService)
    usersService = module.get(UsersService)
    db.query.mockImplementation(async (sql: string, params: unknown[]) => {
      if (sql.includes('SELECT')) {
        return {
          rows: storedToken === params[0] ? [{ ...user }] : [],
          rowCount: storedToken === params[0] ? 1 : 0
        }
      }
      if (sql.includes('SET password_hash')) {
        expect(sql).toContain('refresh_token = NULL, refresh_token_expires_at = NULL')
        storedToken = null
        return { rows: [{ ...user }], rowCount: 1 }
      }
      if (sql.includes('SET is_verified')) {
        expect(sql).toContain('refresh_token = CASE WHEN $1 THEN refresh_token ELSE NULL END')
        expect(sql).toContain(
          'refresh_token_expires_at = CASE WHEN $1 THEN refresh_token_expires_at ELSE NULL END'
        )
        if (!params[0]) storedToken = null
        return { rows: [{ ...user, is_verified: params[0] }], rowCount: 1 }
      }
      if (sql.includes('SET refresh_token = NULL')) {
        expect(sql).toContain('WHERE refresh_token = $1')
        if (storedToken === params[0]) storedToken = null
        return { rows: [], rowCount: 1 }
      }
      expect(sql).toContain('WHERE id = $3 AND refresh_token = $4 AND is_verified = TRUE')
      expect(sql).toContain('refresh_token_expires_at > NOW() AND role = $5')
      if (storedToken !== params[3]) return { rows: [], rowCount: 0 }
      storedToken = params[0] as string
      return { rows: [], rowCount: 1 }
    })
  })

  it('allows exactly one of two requests using the same refresh token to succeed', async () => {
    let release!: () => void
    const bothIssuing = new Promise<void>((resolve) => {
      release = resolve
    })
    let calls = 0
    issuer.mockImplementation(async () => {
      calls += 1
      if (calls === 2) release()
      await bothIssuing
      return new Response(JSON.stringify({ token: 'new-access' }), {
        headers: { 'content-type': 'application/json' }
      })
    })

    const outcomes = await Promise.allSettled([
      service.refreshToken('original-refresh'),
      service.refreshToken('original-refresh')
    ])
    const successes = outcomes.filter((result) => result.status === 'fulfilled')
    expect(successes).toHaveLength(1)
    expect(successes[0].value.refresh_token).toBe(storedToken)
    const failure = outcomes.find((result) => result.status === 'rejected')
    expect(failure?.reason).toMatchObject({ code: 'AUTHENTICATION_ERROR' })
    await expect(service.refreshToken('original-refresh')).rejects.toMatchObject({
      code: 'AUTHENTICATION_ERROR'
    })
  })

  it.each([
    { is_verified: false },
    { refresh_token_expires_at: null },
    { refresh_token_expires_at: new Date(0) },
    { refresh_token_expires_at: 'invalid' },
    { role: 'unknown' }
  ])('rejects an ineligible stored session: %j', async (overrides) => {
    db.query.mockResolvedValue({
      rows: [{ ...user, ...overrides }],
      rowCount: 1
    })
    await expect(service.refreshToken('original-refresh')).rejects.toMatchObject({
      code: 'AUTHENTICATION_ERROR'
    })
    expect(issuer).not.toHaveBeenCalled()
  })

  it('does not return credentials when rotation persistence fails', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [user], rowCount: 1 })
      .mockRejectedValueOnce(new Error('database unavailable'))
    await expect(service.refreshToken('original-refresh')).rejects.toMatchObject({
      code: 'DATABASE_ERROR'
    })
  })

  it('logout is idempotent and an obsolete token cannot log out a newer session', async () => {
    expect(await service.logout('obsolete-refresh')).toEqual({ success: true })
    expect(storedToken).toBe('original-refresh')
    expect(await service.logout('original-refresh')).toEqual({ success: true })
    expect(await service.logout('original-refresh')).toEqual({ success: true })
    await expect(service.refreshToken('original-refresh')).rejects.toMatchObject({
      code: 'AUTHENTICATION_ERROR'
    })
  })

  it('password reset prevents renewal with the previous refresh token', async () => {
    await usersService.resetPassword(user.id, {
      newPassword: 'new-secure-password',
      sendEmail: false
    })
    await expect(service.refreshToken('original-refresh')).rejects.toMatchObject({
      code: 'AUTHENTICATION_ERROR'
    })
    expect(issuer).not.toHaveBeenCalled()
  })

  it('unverification revokes renewal and reverification does not restore it', async () => {
    await usersService.updateVerification(user.id, { isVerified: false })
    await usersService.updateVerification(user.id, { isVerified: true })
    await expect(service.refreshToken('original-refresh')).rejects.toMatchObject({
      code: 'AUTHENTICATION_ERROR'
    })
  })

  it('cannot restore a refresh token when password reset happens during token issuance', async () => {
    issuer.mockImplementation(async () => {
      await usersService.resetPassword(user.id, {
        newPassword: 'new-secure-password',
        sendEmail: false
      })
      return new Response(JSON.stringify({ token: 'new-access' }), {
        headers: { 'content-type': 'application/json' }
      })
    })
    await expect(service.refreshToken('original-refresh')).rejects.toMatchObject({
      code: 'AUTHENTICATION_ERROR'
    })
    expect(storedToken).toBeNull()
  })

  it('cannot create a session when login loses a race with an account change', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [
          {
            ...user,
            firstName: null,
            lastName: null,
            passwordHash: 'old-password-hash',
            isVerified: true
          }
        ],
        rowCount: 1
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })

    await expect(service.login(user.email, 'old-password')).rejects.toMatchObject({
      code: 'AUTHENTICATION_ERROR'
    })
    expect(db.query).toHaveBeenLastCalledWith(
      expect.stringContaining(
        'WHERE id = $3 AND password_hash = $4 AND is_verified = TRUE AND role = $5'
      ),
      [expect.any(String), expect.any(Date), user.id, 'old-password-hash', user.role]
    )
  })
})
