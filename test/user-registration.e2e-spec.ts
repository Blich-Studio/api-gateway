import type { INestApplication } from '@nestjs/common'
import type { TestingModule } from '@nestjs/testing'
import { Test } from '@nestjs/testing'
import { ConfigModule } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import request from 'supertest'
import type { Mock } from 'vitest'
import { vi, beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest'
import { Pool } from 'pg'
import { AppModule } from '../src/app.module'

interface EmailServiceMock {
  sendVerificationEmail: Mock
}

interface RegisterUserDto {
  email: string
  password: string
  name: string
}

interface VerifyEmailDto {
  token: string
}

interface ResendVerificationDto {
  email: string
}

describe('User Registration (e2e)', () => {
  let app: INestApplication
  let dbPool: Pool
  let emailService: EmailServiceMock

  // Setup test database connection
  beforeAll(async () => {
    // Load test environment variables
    process.env.NODE_ENV = 'test'
    
    // Create real database connection pool for tests
    dbPool = new Pool({
      host: process.env.POSTGRES_HOST || '34.52.194.65',
      port: Number(process.env.POSTGRES_PORT) || 5432,
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || '',
      database: process.env.POSTGRES_DB || 'blich_studio_test',
      ssl: {
        rejectUnauthorized: false,
      },
    })

    // Mock Email Service (we don't want to send real emails in tests)
    emailService = {
      sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        AppModule,
      ],
    })
      .overrideProvider('POSTGRES_CLIENT')
      .useValue(dbPool)
      .overrideProvider('EMAIL_SERVICE')
      .useValue(emailService)
      .overrideProvider(APP_GUARD)
      .useValue({ canActivate: () => true }) // Disable ThrottlerGuard for tests
      .compile()

    app = moduleFixture.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    // Clean up test data
    await dbPool.query('DELETE FROM verification_tokens')
    await dbPool.query('DELETE FROM users')
    await dbPool.end()
    await app.close()
  })

  beforeEach(async () => {
    // Clean database before each test
    await dbPool.query('DELETE FROM verification_tokens')
    await dbPool.query('DELETE FROM users')
    vi.clearAllMocks()
  })

  describe('Feature: User registration', () => {
    describe('Background: Authentication API is available', () => {
      it('should have the authentication API available', async () => {
        const response = await request(app.getHttpServer()).get('/health')

        expect(response.status).toBeLessThan(500)
      })
    })

    describe('Scenario: Successful registration with valid data', () => {
      const newUserEmail = 'new.user@example.com'
      const newUserData: RegisterUserDto = {
        email: newUserEmail,
        password: 'StrongPass123!!',
        name: 'New User',
      }

      beforeEach(() => {
        // Mock: No existing user with this email
        postgresClient.query.mockImplementation((query: string) => {
          if (query.includes('SELECT') && query.includes('FROM users')) {
            return Promise.resolve({ rows: [], rowCount: 0 })
          }
          // Mock successful INSERT INTO users
          if (query.includes('INSERT INTO users')) {
            return Promise.resolve({
              rows: [
                {
                  id: 'user-123',
                  email: newUserEmail,
                  name: newUserData.name,
                  is_verified: false,
                  created_at: new Date(),
                },
              ],
              rowCount: 1,
            })
          }
          // Mock INSERT INTO verification_tokens
          if (query.includes('INSERT INTO verification_tokens')) {
            return Promise.resolve({
              rows: [{ token: 'mock-token-hash' }],
              rowCount: 1,
            })
          }
          return Promise.resolve({ rows: [], rowCount: 0 })
        })
      })

      it('Given there is no existing user with email "new.user@example.com"', async () => {
        const result = await postgresClient.query('SELECT * FROM users WHERE email = $1', [
          newUserEmail,
        ])
        expect(result.rows.length).toBe(0)
      })

      it('When I submit a registration request with valid data, Then the response status should be 201', async () => {
        const response = await request(app.getHttpServer()).post('/auth/register').send(newUserData)

        expect(response.status).toBe(201)
      })

      it('And the response body should contain a user id', async () => {
        const response = await request(app.getHttpServer()).post('/auth/register').send(newUserData)

        expect(response.body.data).toHaveProperty('id')
        expect(response.body.data.id).toBeTruthy()
      })

      it('And the response body should not contain the password', async () => {
        const response = await request(app.getHttpServer()).post('/auth/register').send(newUserData)

        expect(response.body.data).not.toHaveProperty('password')
        expect(JSON.stringify(response.body)).not.toContain(newUserData.password)
      })

      it('And a user with email "new.user@example.com" should exist in the system', async () => {
        await request(app.getHttpServer()).post('/auth/register').send(newUserData)

        // Verify the INSERT query was called
        expect(postgresClient.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO users'),
          expect.arrayContaining([newUserEmail])
        )
      })
    })

    describe('Scenario: Registration fails when email already exists', () => {
      const existingEmail = 'taken.user@example.com'
      const takenUserData: RegisterUserDto = {
        email: existingEmail,
        password: 'SomePass123!!',
        name: 'Taken User',
      }

      beforeEach(() => {
        // Mock: User already exists
        postgresClient.query.mockImplementation((query: string) => {
          if (query.includes('SELECT') && query.includes('FROM users')) {
            return Promise.resolve({
              rows: [{ id: 'existing-user-123' }],
              rowCount: 1,
            })
          }
          return Promise.resolve({ rows: [], rowCount: 0 })
        })
      })

      it('Given a user with email "taken.user@example.com" already exists', async () => {
        const result = await postgresClient.query('SELECT * FROM users WHERE email = $1', [
          existingEmail,
        ])
        expect(result.rows.length).toBe(1)
        expect(result.rows[0].email).toBe(existingEmail)
      })

      it('When I submit a registration request, Then the response status should be 409', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .send(takenUserData)

        expect(response.status).toBe(409)
      })

      it('And the response body should contain an error code "EMAIL_ALREADY_IN_USE"', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .send(takenUserData)

        expect(response.body.code).toBe('EMAIL_ALREADY_IN_USE')
        expect(response.body.message).toBeDefined()
      })
    })

    describe('Scenario: Registration fails on invalid password', () => {
      const weakPasswordData: RegisterUserDto = {
        email: 'weak.user@example.com',
        password: '123',
        name: 'Weak User',
      }

      beforeEach(() => {
        // Mock: No existing user (validation error happens before DB call anyway)
        postgresClient.query.mockImplementation((query: string) => {
          if (query.includes('SELECT') && query.includes('FROM users')) {
            return Promise.resolve({ rows: [], rowCount: 0 })
          }
          return Promise.resolve({ rows: [], rowCount: 0 })
        })
      })

      it('When I submit a registration request with weak password, Then the response status should be 400', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .send(weakPasswordData)

        expect(response.status).toBe(400)
      })

      it('And the response body should contain a validation error for "password"', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .send(weakPasswordData)

        expect(response.body.message).toBeDefined()
        const errorMessage = Array.isArray(response.body.message)
          ? response.body.message.join(' ')
          : response.body.message
        expect(errorMessage).toMatch(/password/i)
      })
    })

    describe('Scenario: Registration sends verification email', () => {
      const verifyUserEmail = 'verify.user@example.com'
      const verifyUserData: RegisterUserDto = {
        email: verifyUserEmail,
        password: 'StrongPass123!!',
        name: 'Verify User',
      }

      beforeEach(() => {
        // Mock: No existing user, successful registration
        postgresClient.query.mockImplementation((query: string) => {
          if (query.includes('SELECT') && query.includes('FROM users')) {
            return Promise.resolve({ rows: [], rowCount: 0 })
          }
          if (query.includes('INSERT INTO users')) {
            return Promise.resolve({
              rows: [
                {
                  id: 'verify-user-123',
                  email: verifyUserEmail,
                  name: verifyUserData.name,
                  is_verified: false,
                  created_at: new Date(),
                },
              ],
              rowCount: 1,
            })
          }
          if (query.includes('INSERT INTO verification_tokens')) {
            return Promise.resolve({
              rows: [{ token: 'mock-token-hash' }],
              rowCount: 1,
            })
          }
          return Promise.resolve({ rows: [], rowCount: 0 })
        })

        emailService.sendVerificationEmail.mockResolvedValue(undefined)
      })

      it('Given there is no existing user with email "verify.user@example.com"', async () => {
        const result = await postgresClient.query('SELECT * FROM users WHERE email = $1', [
          verifyUserEmail,
        ])
        expect(result.rows.length).toBe(0)
      })

      it('When I submit a registration request, Then the response status should be 201', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .send(verifyUserData)

        expect(response.status).toBe(201)
      })

      it('And a pending user with email "verify.user@example.com" should exist in the system', async () => {
        await request(app.getHttpServer()).post('/auth/register').send(verifyUserData)

        // Verify user was created with is_verified = false
        expect(postgresClient.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO users'),
          expect.arrayContaining([verifyUserEmail])
        )
      })

      it('And a verification email should be sent to "verify.user@example.com"', async () => {
        await request(app.getHttpServer()).post('/auth/register').send(verifyUserData)

        expect(emailService.sendVerificationEmail).toHaveBeenCalledWith(
          expect.objectContaining({
            email: verifyUserEmail,
            token: expect.any(String),
          })
        )
      })
    })

    describe('Scenario: Successful email verification', () => {
      const verifyUserEmail = 'verify.user@example.com'
      const validToken = 'valid-verification-token-123'
      const userId = 'pending-user-123'

      beforeEach(() => {
        const crypto = require('crypto')
        const tokenHash = crypto.createHash('sha256').update(validToken).digest('hex')
        const tokenPrefix = validToken.substring(0, 8)

        postgresClient.query.mockImplementation((query: string, params?: any[]) => {
          // Mock: Pending user exists
          if (
            query.includes('SELECT') &&
            query.includes('users') &&
            params?.[0] === verifyUserEmail
          ) {
            return Promise.resolve({
              rows: [
                {
                  id: userId,
                  email: verifyUserEmail,
                  is_verified: false,
                },
              ],
              rowCount: 1,
            })
          }
          // Mock: Valid verification token exists (by token_prefix)
          if (
            query.includes('SELECT') &&
            query.includes('verification_tokens') &&
            query.includes('token_prefix')
          ) {
            return Promise.resolve({
              rows: [
                {
                  token: tokenHash,
                  token_prefix: tokenPrefix,
                  user_id: userId,
                  email: verifyUserEmail,
                  expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
                },
              ],
              rowCount: 1,
            })
          }
          // Mock: Update user verification status
          if (query.includes('UPDATE users') && query.includes('is_verified')) {
            return Promise.resolve({
              rows: [
                {
                  id: userId,
                  email: verifyUserEmail,
                  is_verified: true,
                },
              ],
              rowCount: 1,
            })
          }
          // Mock: DELETE verification token
          if (query.includes('DELETE FROM verification_tokens')) {
            return Promise.resolve({ rows: [], rowCount: 1 })
          }
          return Promise.resolve({ rows: [], rowCount: 0 })
        })
      })

      it('Given a pending user with email "verify.user@example.com" exists', async () => {
        const result = await postgresClient.query('SELECT * FROM users WHERE email = $1', [
          verifyUserEmail,
        ])
        expect(result.rows.length).toBe(1)
        expect(result.rows[0].is_verified).toBe(false)
      })

      it('And a valid verification token was issued for "verify.user@example.com"', async () => {
        const tokenPrefix = validToken.substring(0, 8)
        const result = await postgresClient.query(
          'SELECT * FROM verification_tokens WHERE token_prefix = $1',
          [tokenPrefix]
        )
        expect(result.rows.length).toBe(1)
        expect(result.rows[0].email).toBe(verifyUserEmail)
      })

      it('When I submit a verification request with that token, Then the response status should be 200', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/verify-email')
          .send({ token: validToken })

        expect(response.status).toBe(200)
      })

      it('And the user with email "verify.user@example.com" should be marked as verified', async () => {
        await request(app.getHttpServer()).post('/auth/verify-email').send({ token: validToken })

        // Verify UPDATE query was called to set is_verified = true
        expect(postgresClient.query).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE users'),
          expect.arrayContaining([userId])
        )
      })
    })

    describe('Scenario: Email verification fails with invalid token', () => {
      const verifyUserEmail = 'verify.user@example.com'
      const invalidToken = 'invalid-token-xyz'
      const userId = 'pending-user-123'

      beforeEach(() => {
        postgresClient.query.mockImplementation((query: string, params?: any[]) => {
          // Mock: Pending user exists
          if (
            query.includes('SELECT') &&
            query.includes('users') &&
            params?.[0] === verifyUserEmail
          ) {
            return Promise.resolve({
              rows: [
                {
                  id: userId,
                  email: verifyUserEmail,
                  is_verified: false,
                },
              ],
              rowCount: 1,
            })
          }
          // Mock: Invalid token - not found
          if (query.includes('SELECT') && query.includes('verification_tokens')) {
            return Promise.resolve({ rows: [], rowCount: 0 })
          }
          return Promise.resolve({ rows: [], rowCount: 0 })
        })
      })

      it('Given a pending user with email "verify.user@example.com" exists', async () => {
        const result = await postgresClient.query('SELECT * FROM users WHERE email = $1', [
          verifyUserEmail,
        ])
        expect(result.rows.length).toBe(1)
        expect(result.rows[0].is_verified).toBe(false)
      })

      it('When I submit a verification request with an invalid token, Then the response status should be 400', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/verify-email')
          .send({ token: invalidToken })

        expect(response.status).toBe(400)
      })

      it('And the response body should contain an error code "INVALID_VERIFICATION_TOKEN"', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/verify-email')
          .send({ token: invalidToken })

        expect(response.body.code).toBe('INVALID_VERIFICATION_TOKEN')
        expect(response.body.message).toBeDefined()
      })

      it('And the user with email "verify.user@example.com" should still be unverified', async () => {
        await request(app.getHttpServer()).post('/auth/verify-email').send({ token: invalidToken })

        // Verify that UPDATE was NOT called
        expect(postgresClient.query).not.toHaveBeenCalledWith(
          expect.stringContaining('UPDATE users'),
          expect.anything()
        )

        // Verify user is still unverified
        const result = await postgresClient.query('SELECT * FROM users WHERE email = $1', [
          verifyUserEmail,
        ])
        expect(result.rows[0].is_verified).toBe(false)
      })
    })

    describe('Scenario: Email verification fails with expired token', () => {
      const verifyUserEmail = 'verify.user@example.com'
      const expiredToken = 'expired-token-123'
      const userId = 'pending-user-123'

      beforeEach(() => {
        const crypto = require('crypto')
        const tokenHash = crypto.createHash('sha256').update(expiredToken).digest('hex')
        const tokenPrefix = expiredToken.substring(0, 8)

        postgresClient.query.mockImplementation((query: string, params?: any[]) => {
          // Mock: Pending user exists
          if (
            query.includes('SELECT') &&
            query.includes('users') &&
            params?.[0] === verifyUserEmail
          ) {
            return Promise.resolve({
              rows: [
                {
                  id: userId,
                  email: verifyUserEmail,
                  is_verified: false,
                },
              ],
              rowCount: 1,
            })
          }
          // Mock: Token exists but is expired (by token_prefix)
          if (
            query.includes('SELECT') &&
            query.includes('verification_tokens') &&
            query.includes('token_prefix')
          ) {
            return Promise.resolve({
              rows: [
                {
                  token: tokenHash,
                  token_prefix: tokenPrefix,
                  user_id: userId,
                  email: verifyUserEmail,
                  expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000), // Expired yesterday
                },
              ],
              rowCount: 1,
            })
          }
          return Promise.resolve({ rows: [], rowCount: 0 })
        })
      })

      it('Given a pending user with email "verify.user@example.com" exists', async () => {
        const result = await postgresClient.query('SELECT * FROM users WHERE email = $1', [
          verifyUserEmail,
        ])
        expect(result.rows.length).toBe(1)
        expect(result.rows[0].is_verified).toBe(false)
      })

      it('And the verification token for "verify.user@example.com" is expired', async () => {
        const tokenPrefix = expiredToken.substring(0, 8)
        const result = await postgresClient.query(
          'SELECT * FROM verification_tokens WHERE token_prefix = $1',
          [tokenPrefix]
        )
        expect(result.rows.length).toBe(1)
        expect(new Date(result.rows[0].expires_at).getTime()).toBeLessThan(Date.now())
      })

      it('When I submit a verification request with that token, Then the response status should be 400', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/verify-email')
          .send({ token: expiredToken })

        expect(response.status).toBe(400)
      })

      it('And the response body should contain an error code "VERIFICATION_TOKEN_EXPIRED"', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/verify-email')
          .send({ token: expiredToken })

        expect(response.body.code).toBe('VERIFICATION_TOKEN_EXPIRED')
        expect(response.body.message).toBeDefined()
      })

      it('And the user with email "verify.user@example.com" should still be unverified', async () => {
        await request(app.getHttpServer()).post('/auth/verify-email').send({ token: expiredToken })

        // Verify user is still unverified
        const result = await postgresClient.query('SELECT * FROM users WHERE email = $1', [
          verifyUserEmail,
        ])
        expect(result.rows[0].is_verified).toBe(false)
      })
    })

    describe('Scenario: Resend verification email for unverified user', () => {
      const verifyUserEmail = 'verify.user@example.com'
      const userId = 'pending-user-123'

      beforeEach(() => {
        postgresClient.query.mockImplementation((query: string, params?: any[]) => {
          // Mock: Pending user exists
          if (query.includes('SELECT') && query.includes('FROM users')) {
            return Promise.resolve({
              rows: [
                {
                  id: userId,
                  email: verifyUserEmail,
                  is_verified: false,
                },
              ],
              rowCount: 1,
            })
          }
          // Mock: Create new verification token
          if (query.includes('INSERT INTO verification_tokens')) {
            return Promise.resolve({
              rows: [{ token: 'mock-token-hash' }],
              rowCount: 1,
            })
          }
          return Promise.resolve({ rows: [], rowCount: 0 })
        })

        emailService.sendVerificationEmail.mockResolvedValue(undefined)
      })

      it('Given a pending user with email "verify.user@example.com" exists', async () => {
        const result = await postgresClient.query('SELECT * FROM users WHERE email = $1', [
          verifyUserEmail,
        ])
        expect(result.rows.length).toBe(1)
        expect(result.rows[0].is_verified).toBe(false)
      })

      it('When I request a new verification email, Then the response status should be 201', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/resend-verification')
          .send({ email: verifyUserEmail })

        expect(response.status).toBe(201)
      })

      it('And a new verification email should be sent to "verify.user@example.com"', async () => {
        await request(app.getHttpServer())
          .post('/auth/resend-verification')
          .send({ email: verifyUserEmail })

        expect(emailService.sendVerificationEmail).toHaveBeenCalledWith(
          expect.objectContaining({
            email: verifyUserEmail,
            token: expect.any(String),
          })
        )
      })
    })
  })
})
