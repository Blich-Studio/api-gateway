import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthService } from './auth.service'
import {
  InvalidCredentialsError,
  EmailNotVerifiedError,
  AuthServiceUnavailableError,
  InvalidAuthResponseError,
  TokenGenerationError,
  AuthenticationError,
} from '../../../common/errors'
import { POSTGRES_CLIENT } from '../../database/postgres.module'

// Mock bcrypt module completely
vi.mock('bcrypt', () => ({
  default: {
    compare: vi.fn(),
  },
  compare: vi.fn(),
}))

// Import bcrypt after mocking
import * as bcrypt from 'bcrypt'

describe('AuthService - Behavior Tests', () => {
  let service: AuthService
  let postgresClient: any

  // Test data - input and expected output
  const validUserInDb = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'valid@example.com',
    nickname: 'Valid User',
    firstName: 'Valid',
    lastName: 'User',
    passwordHash: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5jtRPZsLqzXrK',
    isVerified: true,
  }

  const unverifiedUserInDb = {
    ...validUserInDb,
    email: 'unverified@example.com',
    isVerified: false,
  }

  const mockConfigService = {
    get: vi.fn((key: string) => {
      const config: Record<string, string> = {
        JWKS_TOKEN_ENDPOINT: 'http://localhost:3100/token',
        JWKS_TOKEN_API_KEY: 'test-api-key',
      }
      return config[key]
    }),
  }

  const mockPostgresClient = {
    query: vi.fn(),
  }

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks()
    global.fetch = vi.fn()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: POSTGRES_CLIENT,
          useValue: mockPostgresClient,
        },
      ],
    }).compile()

    service = module.get<AuthService>(AuthService)
    postgresClient = module.get(POSTGRES_CLIENT)
  })

  describe('login - Contract Tests', () => {
    it('should return access token and user data when credentials are valid', async () => {
      // Given: valid user exists in database
      mockPostgresClient.query.mockResolvedValue({
        rows: [validUserInDb],
        rowCount: 1,
      })

      // And: password verification succeeds
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never)

      // And: token service returns valid token
      const mockToken = 'valid.jwt.token'
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ token: mockToken }),
      })

      // When: user attempts to login with correct credentials
      const result = await service.login(validUserInDb.email, 'correct-password')

      // Then: should return access token and user information
      expect(result).toEqual({
        access_token: mockToken,
        user: {
          id: validUserInDb.id,
          email: validUserInDb.email,
          name: validUserInDb.nickname,
        },
      })
    })

    it('should throw UnauthorizedException when email does not exist', async () => {
      // Given: user does not exist in database
      mockPostgresClient.query.mockResolvedValue({
        rows: [],
        rowCount: 0,
      })

      // When: attempting to login with non-existent email
      // Then: should throw InvalidCredentialsError
      await expect(service.login('nonexistent@example.com', 'any-password')).rejects.toThrow(
        InvalidCredentialsError
      )
    })

    it('should throw UnauthorizedException when password is incorrect', async () => {
      // Given: valid user exists in database
      mockPostgresClient.query.mockResolvedValue({
        rows: [validUserInDb],
        rowCount: 1,
      })

      // And: password verification fails
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never)

      // When: attempting to login with incorrect password
      // Then: should throw InvalidCredentialsError
      await expect(service.login(validUserInDb.email, 'wrong-password')).rejects.toThrow(
        InvalidCredentialsError
      )
    })

    it('should throw UnauthorizedException when email is not verified', async () => {
      // Given: unverified user exists in database
      mockPostgresClient.query.mockResolvedValue({
        rows: [unverifiedUserInDb],
        rowCount: 1,
      })

      // And: password verification succeeds
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never)

      // When: attempting to login with unverified email
      // Then: should throw EmailNotVerifiedError
      await expect(service.login(unverifiedUserInDb.email, 'correct-password')).rejects.toThrow(
        EmailNotVerifiedError
      )
    })

    it('should throw UnauthorizedException when database returns invalid data', async () => {
      // Given: database returns malformed data
      mockPostgresClient.query.mockResolvedValue({
        rows: [{ invalid: 'data', missing: 'required fields' }],
        rowCount: 1,
      })

      // When: attempting to login
      // Then: should throw InvalidCredentialsError (graceful degradation)
      await expect(service.login('any@example.com', 'any-password')).rejects.toThrow(
        InvalidCredentialsError
      )
    })

    it('should throw UnauthorizedException when token service is unavailable', async () => {
      // Given: valid credentials
      mockPostgresClient.query.mockResolvedValue({
        rows: [validUserInDb],
        rowCount: 1,
      })
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never)

      // And: token service returns 500 error
      ;(global.fetch as any).mockResolvedValue({
        ok: false,
        status: 500,
        headers: { get: () => null },
      })

      // When: attempting to login
      // Then: should throw AuthServiceUnavailableError
      await expect(service.login(validUserInDb.email, 'correct-password')).rejects.toThrow(
        AuthServiceUnavailableError
      )
    })

    it('should throw UnauthorizedException when token service returns invalid response', async () => {
      // Given: valid credentials
      mockPostgresClient.query.mockResolvedValue({
        rows: [validUserInDb],
        rowCount: 1,
      })
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never)

      // And: token service returns non-JSON response
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        headers: { get: () => 'text/html' },
      })

      // When: attempting to login
      // Then: should throw InvalidAuthResponseError
      await expect(service.login(validUserInDb.email, 'correct-password')).rejects.toThrow(
        InvalidAuthResponseError
      )
    })

    it('should throw UnauthorizedException when token service times out', async () => {
      // Given: valid credentials
      mockPostgresClient.query.mockResolvedValue({
        rows: [validUserInDb],
        rowCount: 1,
      })
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never)

      // And: token service request times out
      const abortError = new Error('The operation was aborted')
      abortError.name = 'AbortError'
      ;(global.fetch as any).mockRejectedValue(abortError)

      // When: attempting to login
      // Then: should throw AuthServiceUnavailableError
      await expect(service.login(validUserInDb.email, 'correct-password')).rejects.toThrow(
        AuthServiceUnavailableError
      )
    })
  })

  describe('refreshToken - Contract Tests', () => {
    it('should throw UnauthorizedException as not implemented', () => {
      // Given: refresh token functionality is not yet implemented
      // When: calling refreshToken
      // Then: should throw AuthenticationError
      expect(() => service.refreshToken()).toThrow(
        AuthenticationError
      )
    })
  })

  describe('Branch Coverage - Token Issuance Error Paths', () => {
    const validUser = {
      id: '550e8400-e29b-41d4-a716-446655440001',
      email: 'test@example.com',
      nickname: 'Test User',
      firstName: 'Test',
      lastName: 'User',
      passwordHash: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5jtRPZsLqzXrK',
      isVerified: true,
    }

    it('should throw error for 4xx client errors from token service', async () => {
      // Given: valid user and password
      mockPostgresClient.query.mockResolvedValue({ 
        rows: [validUser],
        rowCount: 1,
      })
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never)

      // And: token service returns 400 client error
      ;(global.fetch as any).mockResolvedValue({
        ok: false,
        status: 400,
        headers: { get: () => 'application/json' },
      })

      // When/Then: should throw TokenGenerationError
      await expect(service.login(validUser.email, 'password')).rejects.toThrow(
        TokenGenerationError
      )
    })

    it('should handle invalid JSON parse errors', async () => {
      // Given: valid user and password
      mockPostgresClient.query.mockResolvedValue({ 
        rows: [validUser],
        rowCount: 1,
      })
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never)

      // And: response with valid content-type but invalid JSON
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: () => Promise.reject(new Error('Unexpected token')),
      })

      // When/Then: should throw InvalidAuthResponseError
      await expect(service.login(validUser.email, 'password')).rejects.toThrow(
        InvalidAuthResponseError
      )
    })

    it('should handle response with invalid structure (missing token)', async () => {
      // Given: valid user and password
      mockPostgresClient.query.mockResolvedValue({ 
        rows: [validUser],
        rowCount: 1,
      })
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never)

      // And: response with valid JSON but wrong structure
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ wrongField: 'value' }),
      })

      // When/Then: should throw InvalidAuthResponseError
      await expect(service.login(validUser.email, 'password')).rejects.toThrow(
        InvalidAuthResponseError
      )
    })

    it('should handle non-Error thrown objects', async () => {
      // Given: valid user and password
      mockPostgresClient.query.mockResolvedValue({ 
        rows: [validUser],
        rowCount: 1,
      })
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never)

      // And: token service throws a non-Error object (string)
      ;(global.fetch as any).mockRejectedValue('string error')

      // When/Then: should throw AuthServiceUnavailableError
      await expect(service.login(validUser.email, 'password')).rejects.toThrow(
        AuthServiceUnavailableError
      )
    })

    it('should handle undefined error objects', async () => {
      // Given: valid user and password
      mockPostgresClient.query.mockResolvedValue({ 
        rows: [validUser],
        rowCount: 1,
      })
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never)

      // And: token service throws undefined
      ;(global.fetch as any).mockRejectedValue(undefined)

      // When/Then: should throw AuthServiceUnavailableError
      await expect(service.login(validUser.email, 'password')).rejects.toThrow(
        AuthServiceUnavailableError
      )
    })

    it('should handle generic network errors (not custom errors or AbortError)', async () => {
      // Given: valid user and password
      mockPostgresClient.query.mockResolvedValue({ 
        rows: [validUser],
        rowCount: 1,
      })
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never)

      // And: token service throws a generic Error
      const networkError = new Error('ECONNREFUSED')
      networkError.name = 'NetworkError'
      ;(global.fetch as any).mockRejectedValue(networkError)

      // When/Then: should throw AuthServiceUnavailableError
      await expect(service.login(validUser.email, 'password')).rejects.toThrow(
        AuthServiceUnavailableError
      )
    })
  })
})
