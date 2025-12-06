import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { JwtStrategy } from './jwt.strategy'
import type { Request } from 'express'

// Mock jose module
vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn(() => vi.fn()),
  jwtVerify: vi.fn(),
}))

import { jwtVerify, createRemoteJWKSet } from 'jose'

describe('JwtStrategy - Contract Tests', () => {
  let strategy: JwtStrategy

  const mockConfigService = {
    get: vi.fn((key: string) => {
      const config: Record<string, string> = {
        JWKS_URL: 'https://auth.example.com/.well-known/jwks.json',
        JWT_ISSUER: 'https://auth.example.com',
        JWT_AUDIENCE: 'api-gateway',
      }
      return config[key]
    }),
  }

  beforeEach(async () => {
    vi.clearAllMocks()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile()

    strategy = module.get<JwtStrategy>(JwtStrategy)
  })

  describe('initialization', () => {
    it('should throw error when JWKS_URL is missing', () => {
      // Given: missing JWKS_URL configuration
      const invalidConfig = {
        get: vi.fn((key: string) => (key === 'JWKS_URL' ? undefined : 'value')),
      }

      // When/Then: should throw configuration error
      expect(
        () =>
          new JwtStrategy(invalidConfig as any)
      ).toThrow('Missing required JWT configuration')
    })

    it('should throw error when JWT_ISSUER is missing', () => {
      // Given: missing JWT_ISSUER configuration
      const invalidConfig = {
        get: vi.fn((key: string) => (key === 'JWT_ISSUER' ? undefined : 'value')),
      }

      // When/Then: should throw configuration error
      expect(
        () =>
          new JwtStrategy(invalidConfig as any)
      ).toThrow('Missing required JWT configuration')
    })

    it('should throw error when JWT_AUDIENCE is missing', () => {
      // Given: missing JWT_AUDIENCE configuration
      const invalidConfig = {
        get: vi.fn((key: string) => (key === 'JWT_AUDIENCE' ? undefined : 'value')),
      }

      // When/Then: should throw configuration error
      expect(
        () =>
          new JwtStrategy(invalidConfig as any)
      ).toThrow('Missing required JWT configuration')
    })

    it('should initialize successfully with valid configuration', () => {
      // Given: valid configuration (already set up in beforeEach)
      // Then: strategy should be created without errors
      expect(strategy).toBeDefined()
      expect(createRemoteJWKSet).toHaveBeenCalled()
    })
  })

  describe('validate - Token Verification', () => {
    it('should return user data when token is valid', async () => {
      // Given: valid JWT token in Authorization header
      const mockRequest = {
        headers: {
          authorization: 'Bearer valid.jwt.token',
        },
      } as Request

      const validPayload = {
        sub: '550e8400-e29b-41d4-a716-446655440000',
        email: 'user@example.com',
        name: 'Test User',
        iat: 1234567890,
        exp: 9999999999,
      }

      vi.mocked(jwtVerify).mockResolvedValue({
        payload: validPayload,
        protectedHeader: { alg: 'RS256' },
      } as any)

      // When: validating the request
      const result = await strategy.validate(mockRequest)

      // Then: should return user information
      expect(result).toEqual({
        userId: validPayload.sub,
        email: validPayload.email,
        name: validPayload.name,
      })
    })

    it('should return user data without name when name is missing', async () => {
      // Given: valid token without name field
      const mockRequest = {
        headers: {
          authorization: 'Bearer valid.jwt.token',
        },
      } as Request

      const payloadWithoutName = {
        sub: '550e8400-e29b-41d4-a716-446655440000',
        email: 'user@example.com',
        iat: 1234567890,
        exp: 9999999999,
      }

      vi.mocked(jwtVerify).mockResolvedValue({
        payload: payloadWithoutName,
        protectedHeader: { alg: 'RS256' },
      } as any)

      // When: validating the request
      const result = await strategy.validate(mockRequest)

      // Then: should return user information with undefined name
      expect(result).toEqual({
        userId: payloadWithoutName.sub,
        email: payloadWithoutName.email,
        name: undefined,
      })
    })

    it('should throw error when Authorization header is missing', async () => {
      // Given: request without Authorization header
      const mockRequest = {
        headers: {},
      } as Request

      // When/Then: should throw error
      await expect(strategy.validate(mockRequest)).rejects.toThrow('No auth token')
    })

    it('should throw error when Authorization header does not start with Bearer', async () => {
      // Given: invalid Authorization header format
      const mockRequest = {
        headers: {
          authorization: 'Basic some-token',
        },
      } as Request

      // When/Then: should throw error
      await expect(strategy.validate(mockRequest)).rejects.toThrow('No auth token')
    })

    it('should throw error when token is expired', async () => {
      // Given: expired JWT token
      const mockRequest = {
        headers: {
          authorization: 'Bearer expired.jwt.token',
        },
      } as Request

      vi.mocked(jwtVerify).mockRejectedValue(new Error('Token expired'))

      // When/Then: should throw error
      await expect(strategy.validate(mockRequest)).rejects.toThrow('Invalid or expired token')
    })

    it('should throw error when token signature is invalid', async () => {
      // Given: token with invalid signature
      const mockRequest = {
        headers: {
          authorization: 'Bearer invalid.signature.token',
        },
      } as Request

      vi.mocked(jwtVerify).mockRejectedValue(new Error('Invalid signature'))

      // When/Then: should throw error
      await expect(strategy.validate(mockRequest)).rejects.toThrow('Invalid or expired token')
    })

    it('should throw error when token payload is missing sub field', async () => {
      // Given: token without sub field
      const mockRequest = {
        headers: {
          authorization: 'Bearer valid.jwt.token',
        },
      } as Request

      const invalidPayload = {
        email: 'user@example.com',
        iat: 1234567890,
        exp: 9999999999,
      }

      vi.mocked(jwtVerify).mockResolvedValue({
        payload: invalidPayload,
        protectedHeader: { alg: 'RS256' },
      } as any)

      // When/Then: should throw error
      await expect(strategy.validate(mockRequest)).rejects.toThrow('Invalid or expired token')
    })

    it('should throw error when token payload is missing email field', async () => {
      // Given: token without email field
      const mockRequest = {
        headers: {
          authorization: 'Bearer valid.jwt.token',
        },
      } as Request

      const invalidPayload = {
        sub: '550e8400-e29b-41d4-a716-446655440000',
        iat: 1234567890,
        exp: 9999999999,
      }

      vi.mocked(jwtVerify).mockResolvedValue({
        payload: invalidPayload,
        protectedHeader: { alg: 'RS256' },
      } as any)

      // When/Then: should throw error
      await expect(strategy.validate(mockRequest)).rejects.toThrow('Invalid or expired token')
    })

    it('should throw error when sub field is not a string', async () => {
      // Given: token with non-string sub
      const mockRequest = {
        headers: {
          authorization: 'Bearer valid.jwt.token',
        },
      } as Request

      const invalidPayload = {
        sub: 12345,
        email: 'user@example.com',
        iat: 1234567890,
        exp: 9999999999,
      }

      vi.mocked(jwtVerify).mockResolvedValue({
        payload: invalidPayload,
        protectedHeader: { alg: 'RS256' },
      } as any)

      // When/Then: should throw error
      await expect(strategy.validate(mockRequest)).rejects.toThrow('Invalid or expired token')
    })

    it('should throw error when email field is not a string', async () => {
      // Given: token with non-string email
      const mockRequest = {
        headers: {
          authorization: 'Bearer valid.jwt.token',
        },
      } as Request

      const invalidPayload = {
        sub: '550e8400-e29b-41d4-a716-446655440000',
        email: { value: 'user@example.com' },
        iat: 1234567890,
        exp: 9999999999,
      }

      vi.mocked(jwtVerify).mockResolvedValue({
        payload: invalidPayload,
        protectedHeader: { alg: 'RS256' },
      } as any)

      // When/Then: should throw error
      await expect(strategy.validate(mockRequest)).rejects.toThrow('Invalid or expired token')
    })
  })
})
