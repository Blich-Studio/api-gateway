import type { INestApplication } from '@nestjs/common'
import type { TestingModule } from '@nestjs/testing'
import { Test } from '@nestjs/testing'
import { ConfigModule } from '@nestjs/config'
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import request from 'supertest'
import type { Mock } from 'vitest'
import { vi, beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest'
import { Pool } from 'pg'
import { AuthModule } from '../src/modules/auth/auth.module'
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor'
import { AppController } from '../src/app.controller'
import { AppService } from '../src/app.service'

interface EmailServiceMock {
  sendVerificationEmail: Mock
}

interface RegisterUserDto {
  email: string
  password: string
  name: string
}

describe('User Registration (e2e) - Real Database', () => {
  let app: INestApplication
  let dbPool: Pool
  let emailService: EmailServiceMock

  beforeAll(async () => {
    // Validate required environment variables
    const requiredEnvVars = ['POSTGRES_HOST', 'POSTGRES_PORT', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missingVars.join(', ')}. ` +
        'Please ensure .env.test is properly configured.'
      );
    }

    // Create real database connection pool for tests
    dbPool = new Pool({
      host: process.env.POSTGRES_HOST,
      port: Number(process.env.POSTGRES_PORT),
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB,
      ssl: {
        rejectUnauthorized: false,
      },
    })

    // Mock Email Service
    emailService = {
      sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        AuthModule,
      ],
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: APP_INTERCEPTOR,
          useClass: ResponseInterceptor,
        },
      ],
    })
      .overrideProvider('POSTGRES_CLIENT')
      .useValue(dbPool)
      .overrideProvider('EMAIL_SERVICE')
      .useValue(emailService)
      .overrideProvider(APP_GUARD)
      .useValue({ canActivate: () => true })
      .compile()

    app = moduleFixture.createNestApplication()
    app.useGlobalPipes(
      new (await import('@nestjs/common')).ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      })
    )
    await app.init()
  })

  afterAll(async () => {
    // Clean up before closing pool (delete in correct order for foreign key constraints)
    try {
      await dbPool.query('DELETE FROM verification_tokens') // Delete child records first
      await dbPool.query('DELETE FROM users') // Then parent records
    } catch (error) {
      // Ignore errors if pool already closed
    }
    await app.close()
    try {
      await dbPool.end()
    } catch (error) {
      // Ignore if already closed
    }
  })

  beforeEach(async () => {
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

      it('And a user with email "new.user@example.com" should exist in the database', async () => {
        await request(app.getHttpServer()).post('/auth/register').send(newUserData)

        const result = await dbPool.query('SELECT * FROM users WHERE email = $1', [newUserEmail])
        expect(result.rows.length).toBe(1)
        expect(result.rows[0].email).toBe(newUserEmail)
        expect(result.rows[0].is_verified).toBe(false)
      })

      it('And a verification token should be created', async () => {
        await request(app.getHttpServer()).post('/auth/register').send(newUserData)

        const result = await dbPool.query('SELECT * FROM verification_tokens WHERE email = $1', [
          newUserEmail,
        ])
        expect(result.rows.length).toBe(1)
        expect(result.rows[0].email).toBe(newUserEmail)
      })

      it('And a verification email should be sent', async () => {
        await request(app.getHttpServer()).post('/auth/register').send(newUserData)

        expect(emailService.sendVerificationEmail).toHaveBeenCalledWith(
          expect.objectContaining({
            email: newUserEmail,
            name: newUserData.name,
            token: expect.any(String),
          })
        )
      })
    })

    describe('Scenario: Registration fails when email already exists', () => {
      const existingEmail = 'existing@example.com'
      const existingUserData: RegisterUserDto = {
        email: existingEmail,
        password: 'Password123!',
        name: 'Existing User',
      }

      beforeEach(async () => {
        // Create existing user
        await request(app.getHttpServer()).post('/auth/register').send(existingUserData)
      })

      it('When I submit a registration request with existing email, Then the response status should be 409', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .send({ ...existingUserData, name: 'Another User' })

        expect(response.status).toBe(409)
      })

      it('And the response body should contain error code "EMAIL_ALREADY_IN_USE"', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .send({ ...existingUserData, name: 'Another User' })

        expect(response.body.code).toBe('EMAIL_ALREADY_IN_USE')
        expect(response.body.message).toBeDefined()
      })
    })

    describe('Scenario: Registration fails on invalid password', () => {
      const weakPasswordData: RegisterUserDto = {
        email: 'weak@example.com',
        password: '123',
        name: 'Weak User',
      }

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

    describe('Scenario: Email verification with valid token', () => {
      const userEmail = 'verify@example.com'
      const userData: RegisterUserDto = {
        email: userEmail,
        password: 'Password123!',
        name: 'Verify User',
      }
      let verificationToken: string

      beforeEach(async () => {
        // Register user
        await request(app.getHttpServer()).post('/auth/register').send(userData)

        // Extract token from email mock
        const emailCall = emailService.sendVerificationEmail.mock.calls[0]
        verificationToken = emailCall[0].token
      })

      it('When I submit a verification request with valid token, Then the response status should be 201', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/verify-email')
          .send({ token: verificationToken })

        expect(response.status).toBe(201)
      })

      it('And the user should be marked as verified in the database', async () => {
        await request(app.getHttpServer()).post('/auth/verify-email').send({ token: verificationToken })

        const result = await dbPool.query('SELECT * FROM users WHERE email = $1', [userEmail])
        expect(result.rows[0].is_verified).toBe(true)
      })

      it('And the verification token should be deleted', async () => {
        await request(app.getHttpServer()).post('/auth/verify-email').send({ token: verificationToken })

        const result = await dbPool.query('SELECT * FROM verification_tokens WHERE email = $1', [
          userEmail,
        ])
        expect(result.rows.length).toBe(0)
      })
    })

    describe('Scenario: Email verification fails with invalid token', () => {
      const invalidToken = 'invalid-token-12345678'

      it('When I submit a verification request with invalid token, Then the response status should be 400', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/verify-email')
          .send({ token: invalidToken })

        expect(response.status).toBe(400)
      })

      it('And the response body should contain error code "INVALID_VERIFICATION_TOKEN"', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/verify-email')
          .send({ token: invalidToken })

        expect(response.body.code).toBe('INVALID_VERIFICATION_TOKEN')
        expect(response.body.message).toBeDefined()
      })
    })

    describe('Scenario: Resend verification email', () => {
      const userEmail = 'resend@example.com'
      const userData: RegisterUserDto = {
        email: userEmail,
        password: 'Password123!',
        name: 'Resend User',
      }

      beforeEach(async () => {
        await request(app.getHttpServer()).post('/auth/register').send(userData)
        vi.clearAllMocks()
      })

      it('When I request a new verification email, Then the response status should be 201', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/resend-verification')
          .send({ email: userEmail })

        expect(response.status).toBe(201)
      })

      it('And a new verification email should be sent', async () => {
        await request(app.getHttpServer()).post('/auth/resend-verification').send({ email: userEmail })

        expect(emailService.sendVerificationEmail).toHaveBeenCalledWith(
          expect.objectContaining({
            email: userEmail,
            token: expect.any(String),
          })
        )
      })
    })
  })
})
