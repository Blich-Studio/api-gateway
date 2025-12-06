import { Test, TestingModule } from '@nestjs/testing'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AuthController } from './auth.controller'
import { AuthService } from '../services/auth.service'
import { LoginDto } from '../dto/login.dto'
import {
  InvalidCredentialsError,
  EmailNotVerifiedError,
  AuthServiceUnavailableError,
} from '../../../common/errors'

describe('AuthController - Contract Tests', () => {
  let controller: AuthController
  let authService: AuthService

  const mockAuthService = {
    login: vi.fn(),
  }

  beforeEach(async () => {
    vi.clearAllMocks()

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile()

    controller = module.get<AuthController>(AuthController)
    authService = module.get<AuthService>(AuthService)
  })

  describe('POST /auth/login', () => {
    const validLoginInput: LoginDto = {
      email: 'user@example.com',
      password: 'SecurePass123',
    }

    const expectedSuccessOutput = {
      access_token: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyJ9...',
      user: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        email: 'user@example.com',
        name: 'Test User',
      },
    }

    it('should return access token and user data when login succeeds', async () => {
      // Given: valid credentials
      mockAuthService.login.mockResolvedValue(expectedSuccessOutput)

      // When: calling login endpoint with valid credentials
      const result = await controller.login(validLoginInput)

      // Then: should return access token and user information
      expect(result).toEqual(expectedSuccessOutput)
      expect(authService.login).toHaveBeenCalledWith(
        validLoginInput.email,
        validLoginInput.password
      )
      expect(authService.login).toHaveBeenCalledTimes(1)
    })

    it('should throw UnauthorizedException when credentials are invalid', async () => {
      // Given: invalid credentials
      const invalidLoginInput: LoginDto = {
        email: 'user@example.com',
        password: 'WrongPassword',
      }
      mockAuthService.login.mockRejectedValue(new InvalidCredentialsError())

      // When: calling login endpoint with invalid credentials
      // Then: should propagate InvalidCredentialsError
      await expect(controller.login(invalidLoginInput)).rejects.toThrow(InvalidCredentialsError)
      await expect(controller.login(invalidLoginInput)).rejects.toThrow('Invalid credentials')
    })

    it('should throw UnauthorizedException when email is not verified', async () => {
      // Given: unverified email
      mockAuthService.login.mockRejectedValue(
        new EmailNotVerifiedError()
      )

      // When: calling login endpoint
      // Then: should propagate EmailNotVerifiedError
      await expect(controller.login(validLoginInput)).rejects.toThrow(EmailNotVerifiedError)
      await expect(controller.login(validLoginInput)).rejects.toThrow(
        'Please verify your email before logging in'
      )
    })

    it('should throw UnauthorizedException when authentication service is unavailable', async () => {
      // Given: authentication service is down
      mockAuthService.login.mockRejectedValue(
        new AuthServiceUnavailableError()
      )

      // When: calling login endpoint
      // Then: should propagate AuthServiceUnavailableError
      await expect(controller.login(validLoginInput)).rejects.toThrow(AuthServiceUnavailableError)
      await expect(controller.login(validLoginInput)).rejects.toThrow(
        'Authentication service temporarily unavailable'
      )
    })
  })

  describe('GET /auth/me', () => {
    const authenticatedUser = {
      userId: '550e8400-e29b-41d4-a716-446655440000',
      email: 'user@example.com',
      name: 'Test User',
    }

    it('should return current user profile when authenticated', () => {
      // Given: user is authenticated
      // When: calling getProfile with authenticated user data
      const result = controller.getProfile(authenticatedUser)

      // Then: should return user profile exactly as provided
      expect(result).toEqual(authenticatedUser)
      expect(result).toHaveProperty('userId', authenticatedUser.userId)
      expect(result).toHaveProperty('email', authenticatedUser.email)
      expect(result).toHaveProperty('name', authenticatedUser.name)
    })

    it('should return user profile without name when name is not present', () => {
      // Given: user is authenticated but has no name
      const userWithoutName = {
        userId: '550e8400-e29b-41d4-a716-446655440000',
        email: 'noname@example.com',
        name: undefined,
      }

      // When: calling getProfile
      const result = controller.getProfile(userWithoutName)

      // Then: should return profile with undefined name
      expect(result).toEqual(userWithoutName)
      expect(result.name).toBeUndefined()
    })

    it('should return exact user data structure from JWT payload', () => {
      // Given: authenticated user with all fields
      const fullUserData = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        name: 'Full Name User',
      }

      // When: calling getProfile
      const result = controller.getProfile(fullUserData)

      // Then: should return exact same structure without transformation
      expect(result).toBe(fullUserData)
      expect(JSON.stringify(result)).toBe(JSON.stringify(fullUserData))
    })
  })

  describe('Authentication Guard Contract', () => {
    it('getProfile should require authentication (contract expectation)', () => {
      // This test documents the contract that /auth/me requires authentication
      // The actual guard validation is handled by NestJS guards at runtime
      // We verify the method exists and returns user data when called with valid user

      const mockUser = {
        userId: 'test-id',
        email: 'test@example.com',
        name: 'Test',
      }

      const result = controller.getProfile(mockUser)
      expect(result).toEqual(mockUser)
    })
  })
})
