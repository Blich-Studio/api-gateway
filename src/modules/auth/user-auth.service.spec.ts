import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { ConflictException, BadRequestException } from '@nestjs/common'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UserAuthService } from './user-auth.service'
import type { PostgresClient } from '../database/postgres.module'
import type { EmailService } from '../email/email.service'

describe('UserAuthService', () => {
  let service: UserAuthService
  let postgresClient: PostgresClient
  let emailService: EmailService
  let configService: ConfigService

  beforeEach(async () => {
    // Mock PostgreSQL client
    postgresClient = {
      query: vi.fn(),
      end: vi.fn(),
    } as unknown as PostgresClient

    // Mock Email Service
    emailService = {
      sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
    } as unknown as EmailService

    // Mock Config Service
    configService = {
      get: vi.fn((key: string, defaultValue?: any) => {
        const config: Record<string, any> = {
          VERIFICATION_TOKEN_EXPIRY_HOURS: 24,
          BCRYPT_SALT_ROUNDS: 10,
          APP_URL: 'http://localhost:3000',
          COMPANY_NAME: 'Test Company',
        }
        return config[key] ?? defaultValue
      }),
      getOrThrow: vi.fn((key: string) => {
        const config: Record<string, any> = {
          VERIFICATION_TOKEN_EXPIRY_HOURS: 24,
        }
        return config[key]
      }),
    } as unknown as ConfigService

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserAuthService,
        {
          provide: 'POSTGRES_CLIENT',
          useValue: postgresClient,
        },
        {
          provide: 'EMAIL_SERVICE',
          useValue: emailService,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile()

    service = module.get<UserAuthService>(UserAuthService)
  })

  describe('register', () => {
    const registerDto = {
      email: 'test@example.com',
      password: 'StrongPass123!',
      name: 'Test User',
    }

    it('should successfully register a new user', async () => {
      const mockUser = {
        id: 'user-123',
        email: registerDto.email,
        name: registerDto.name,
        is_verified: false,
        created_at: new Date(),
      }

      vi.mocked(postgresClient.query)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // Check user exists
        .mockResolvedValueOnce({ rows: [mockUser], rowCount: 1 } as any) // Insert user
        .mockResolvedValueOnce({ rows: [{ token: 'hash' }], rowCount: 1 } as any) // Insert token

      const result = await service.register(registerDto)

      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        isVerified: false,
        createdAt: mockUser.created_at,
      })
      expect(emailService.sendVerificationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          email: registerDto.email,
          name: registerDto.name,
          token: expect.any(String),
        })
      )
    })

    it('should throw ConflictException if email already exists', async () => {
      vi.mocked(postgresClient.query).mockResolvedValueOnce({
        rows: [{ id: 'existing-id' }],
        rowCount: 1,
      } as any)

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException)
      expect(emailService.sendVerificationEmail).not.toHaveBeenCalled()
    })

    it('should not contain password in response', async () => {
      const mockUser = {
        id: 'user-123',
        email: registerDto.email,
        name: registerDto.name,
        is_verified: false,
        created_at: new Date(),
      }

      vi.mocked(postgresClient.query)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
        .mockResolvedValueOnce({ rows: [mockUser], rowCount: 1 } as any)
        .mockResolvedValueOnce({ rows: [{ token: 'hash' }], rowCount: 1 } as any)

      const result = await service.register(registerDto)

      expect(result).not.toHaveProperty('password')
      expect(result).not.toHaveProperty('passwordHash')
    })
  })

  describe('verifyEmail', () => {
    it('should throw BadRequestException for invalid token', async () => {
      vi.mocked(postgresClient.query).mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any)

      await expect(
        service.verifyEmail({ token: 'invalid-token-12345678' })
      ).rejects.toThrow(BadRequestException)
    })

    it('should throw BadRequestException for expired token', async () => {
      const crypto = await import('crypto')
      const token = 'expired-token-12345678'
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

      vi.mocked(postgresClient.query).mockResolvedValueOnce({
        rows: [
          {
            token: tokenHash,
            token_prefix: token.substring(0, 8),
            user_id: 'user-123',
            email: 'test@example.com',
            expires_at: new Date(Date.now() - 1000), // Expired
          },
        ],
        rowCount: 1,
      } as any)

      await expect(service.verifyEmail({ token })).rejects.toThrow(BadRequestException)
    })

    it('should successfully verify email with valid token', async () => {
      const crypto = await import('crypto')
      const token = 'valid-token-12345678'
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

      vi.mocked(postgresClient.query)
        .mockResolvedValueOnce({
          rows: [
            {
              token: tokenHash,
              token_prefix: token.substring(0, 8),
              user_id: 'user-123',
              email: 'test@example.com',
              expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // Valid
            },
          ],
          rowCount: 1,
        } as any) // Select token
        .mockResolvedValueOnce({
          rows: [{ id: 'user-123', is_verified: true }],
          rowCount: 1,
        } as any) // Update user
        .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // Delete token
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // Cleanup expired

      const result = await service.verifyEmail({ token })

      expect(result).toEqual({ message: 'Email verified successfully' })
    })
  })

  describe('resendVerification', () => {
    it('should send new verification email for unverified user', async () => {
      const email = 'test@example.com'

      vi.mocked(postgresClient.query)
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'user-123',
              email,
              name: 'Test User',
              is_verified: false,
            },
          ],
          rowCount: 1,
        } as any) // Find user
        .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // Delete old tokens
        .mockResolvedValueOnce({ rows: [{ token: 'hash' }], rowCount: 1 } as any) // Insert token

      const result = await service.resendVerification({ email })

      expect(result.message).toBe('Verification email sent successfully')
      expect(emailService.sendVerificationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          email,
          token: expect.any(String),
        })
      )
    })

    it('should return generic message for non-existent user', async () => {
      vi.mocked(postgresClient.query).mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any)

      const result = await service.resendVerification({ email: 'nonexistent@example.com' })

      expect(result.message).toContain('verification email has been sent')
      expect(emailService.sendVerificationEmail).not.toHaveBeenCalled()
    })

    it('should return helpful message for already verified user', async () => {
      vi.mocked(postgresClient.query).mockResolvedValueOnce({
        rows: [
          {
            id: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
            password_hash: 'hash',
            is_verified: true,
            created_at: new Date(),
          },
        ],
        rowCount: 1,
      } as any)

      const result = await service.resendVerification({ email: 'test@example.com' })

      expect(result.message).toBe('This email address is already verified. You can proceed to log in.')
      expect(emailService.sendVerificationEmail).not.toHaveBeenCalled()
    })
  })
})
