import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'crypto'
import { UserAuthService } from './user-auth.service'
import type { PostgresClient } from '../database/postgres.module'
import type { EmailService } from '../email/email.service'
import {
  EmailAlreadyInUseError,
  InvalidVerificationTokenError,
  VerificationTokenExpiredError,
} from '../../common/errors'

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

    it('should throw EmailAlreadyInUseError if email already exists', async () => {
      vi.mocked(postgresClient.query).mockResolvedValueOnce({
        rows: [{ id: 'existing-id' }],
        rowCount: 1,
      } as any)

      await expect(service.register(registerDto)).rejects.toThrow(EmailAlreadyInUseError)
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
    it('should throw InvalidVerificationTokenError for invalid token', async () => {
      vi.mocked(postgresClient.query).mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any)

      await expect(
        service.verifyEmail({ token: 'invalid-token-12345678' })
      ).rejects.toThrow(InvalidVerificationTokenError)
    })

    it('should throw VerificationTokenExpiredError for expired token', async () => {
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

      await expect(service.verifyEmail({ token })).rejects.toThrow(VerificationTokenExpiredError)
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

  describe('Branch Coverage - Cleanup Throttle', () => {
    it('should log cleanup when expired tokens are found', async () => {
      // Given: valid token exists that will be verified (triggers cleanup)
      const token = 'test-token-12345678'
      const tokenHash = createHash('sha256').update(token).digest('hex')
      
      vi.mocked(postgresClient.query)
        .mockResolvedValueOnce({ // Token prefix lookup
          rows: [{
            token: tokenHash,
            user_id: 'user-123',
            email: 'test@example.com',
            expires_at: new Date(Date.now() + 1000000).toISOString(),
            token_prefix: token.substring(0, 8),
          }],
          rowCount: 1,
        } as any)
        .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // Update user
        .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // Delete used token
        .mockResolvedValueOnce({ rows: [], rowCount: 5 } as any) // Cleanup expired tokens

      // When: verifying email (triggers cleanup in background)
      await service.verifyEmail({ token })

      // Wait for background cleanup to complete
      await new Promise(resolve => setTimeout(resolve, 100))

      // Then: cleanup query should have been called
      const cleanupCalls = vi.mocked(postgresClient.query).mock.calls.filter(call =>
        typeof call[0] === 'string' && call[0].includes('DELETE FROM verification_tokens WHERE expires_at')
      )
      expect(cleanupCalls.length).toBeGreaterThan(0)
    })
  })

  describe('Branch Coverage - Error Paths', () => {
    it('should throw error when TOKEN_PREFIX_LENGTH mismatches with database', async () => {
      // Create a fresh service instance that will run onModuleInit
      const mockClient = {
        query: vi.fn().mockResolvedValue({
          rows: [{ character_maximum_length: 10 }], // Different from expected 8
          rowCount: 1,
        }),
      }

      await expect(async () => {
        const module = await Test.createTestingModule({
          providers: [
            UserAuthService,
            { provide: 'POSTGRES_CLIENT', useValue: mockClient },
            { provide: 'EMAIL_SERVICE', useValue: emailService },
            { provide: ConfigService, useValue: configService },
          ],
        }).compile()

        await module.init()
      }).rejects.toThrow('TOKEN_PREFIX_LENGTH configuration mismatch')
    })

    it('should handle database error during onModuleInit gracefully', async () => {
      // Create a fresh service instance with failing database
      const mockClient = {
        query: vi.fn().mockRejectedValue(new Error('Database connection failed')),
      }

      // Should not throw, just log warning
      const module = await Test.createTestingModule({
        providers: [
          UserAuthService,
          { provide: 'POSTGRES_CLIENT', useValue: mockClient },
          { provide: 'EMAIL_SERVICE', useValue: emailService },
          { provide: ConfigService, useValue: configService },
        ],
      }).compile()

      await expect(module.init()).resolves.not.toThrow()
    })

    it('should handle race condition during registration (duplicate email)', async () => {
      // Given: email doesn't exist initially but gets inserted by another request
      vi.mocked(postgresClient.query)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // Email doesn't exist check
        .mockRejectedValueOnce(Object.assign(new Error('duplicate key'), { code: '23505' })) // Insert fails with duplicate key

      // When/Then: should throw EmailAlreadyInUseError
      await expect(
        service.register({
          email: 'race@example.com',
          password: 'Password123!',
          name: 'Race User',
        })
      ).rejects.toThrow(EmailAlreadyInUseError)
    })

    it('should handle unexpected database error during registration', async () => {
      // Given: email doesn't exist but database fails with unexpected error
      vi.mocked(postgresClient.query)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // Email doesn't exist check
        .mockRejectedValueOnce(new Error('Database connection lost'))

      // When/Then: should rethrow the error
      await expect(
        service.register({
          email: 'error@example.com',
          password: 'Password123!',
          name: 'Error User',
        })
      ).rejects.toThrow('Database connection lost')
    })

    it('should handle error during token creation', async () => {
      // Given: email doesn't exist
      vi.mocked(postgresClient.query)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // Email doesn't exist check
        .mockResolvedValueOnce({ // User created
          rows: [
            {
              id: 'user-123',
              email: 'test@example.com',
              name: 'Test User',
              is_verified: false,
              created_at: new Date(),
            },
          ],
          rowCount: 1,
        } as any)
        .mockRejectedValueOnce(new Error('Token insert failed')) // Token creation fails

      // When/Then: should rethrow the error
      await expect(
        service.register({
          email: 'test@example.com',
          password: 'Password123!',
          name: 'Test User',
        })
      ).rejects.toThrow('Token insert failed')
    })

    it('should handle cleanup failure silently', async () => {
      const token = 'test-token-12345678'
      const tokenHash = createHash('sha256').update(token).digest('hex')
      
      vi.mocked(postgresClient.query)
        .mockResolvedValueOnce({ // Token prefix lookup
          rows: [{
            token: tokenHash,
            user_id: 'user-123',
            email: 'test@example.com',
            expires_at: new Date(Date.now() + 1000000).toISOString(),
            token_prefix: token.substring(0, 8),
          }],
          rowCount: 1,
        } as any)
        .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // Update user
        .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // Delete used token
        .mockRejectedValueOnce(new Error('Cleanup failed')) // Cleanup fails

      // When: verifying email (triggers cleanup that fails)
      const result = await service.verifyEmail({ token })

      // Then: should still succeed
      expect(result.message).toBe('Email verified successfully')

      // Wait for background cleanup to complete
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    it('should skip cleanup when throttled', async () => {
      // First verification to set lastCleanupTime
      const token1 = 'test-token-12345678'
      const tokenHash1 = createHash('sha256').update(token1).digest('hex')
      
      vi.mocked(postgresClient.query)
        .mockResolvedValueOnce({
          rows: [{
            token: tokenHash1,
            user_id: 'user-1',
            email: 'test1@example.com',
            expires_at: new Date(Date.now() + 1000000).toISOString(),
            token_prefix: token1.substring(0, 8),
          }],
          rowCount: 1,
        } as any)
        .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // Update user
        .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // Delete token
        .mockResolvedValueOnce({ rows: [], rowCount: 3 } as any) // First cleanup

      await service.verifyEmail({ token: token1 })
      await new Promise(resolve => setTimeout(resolve, 100))

      // Second verification immediately after (should be throttled)
      const token2 = 'test-token-87654321'
      const tokenHash2 = createHash('sha256').update(token2).digest('hex')
      
      vi.mocked(postgresClient.query)
        .mockResolvedValueOnce({
          rows: [{
            token: tokenHash2,
            user_id: 'user-2',
            email: 'test2@example.com',
            expires_at: new Date(Date.now() + 1000000).toISOString(),
            token_prefix: token2.substring(0, 8),
          }],
          rowCount: 1,
        } as any)
        .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // Update user
        .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // Delete token
        // No cleanup should happen here

      await service.verifyEmail({ token: token2 })
      await new Promise(resolve => setTimeout(resolve, 100))

      // Then: cleanup should only have been called once (first time)
      const cleanupCalls = vi.mocked(postgresClient.query).mock.calls.filter(call =>
        typeof call[0] === 'string' && call[0].includes('DELETE FROM verification_tokens WHERE expires_at')
      )
      expect(cleanupCalls.length).toBe(1)
    })
  })
})
