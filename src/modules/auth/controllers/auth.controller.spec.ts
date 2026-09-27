import { Test, TestingModule } from '@nestjs/testing'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AuthController } from './auth.controller'
import { AuthService } from '../services/auth.service'
import { LoginDto } from '../dto/login.dto'
import { RefreshTokenDto } from '../dto/refresh-token.dto'
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
    refreshToken: vi.fn(),
    getProfile: vi.fn(),
    logout: vi.fn(),
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
    it('loads the current database profile by subject instead of returning JWT claims', async () => {
      const profile = {
        userId: '550e8400-e29b-41d4-a716-446655440000',
        email: 'current@example.com',
        name: 'Current name',
        role: 'reader',
      }
      mockAuthService.getProfile.mockResolvedValue(profile)

      expect(await controller.getProfile({ ...profile, email: 'stale@example.com' })).toEqual(profile)
      expect(mockAuthService.getProfile).toHaveBeenCalledWith(profile.userId)
    })
  })

  describe('POST /auth/logout', () => {
    it('revokes only the presented refresh token', async () => {
      mockAuthService.logout.mockResolvedValue({ success: true })
      expect(await controller.logout({ refreshToken: 'current-refresh' })).toEqual({ success: true })
      expect(mockAuthService.logout).toHaveBeenCalledWith('current-refresh')
    })
  })

  describe('POST /auth/refresh', () => {
    const validRefreshInput: RefreshTokenDto = {
      refreshToken: 'valid-refresh-token-1234567890',
    }

    it('should return new access token for valid refresh token', async () => {
      const expectedOutput = {
        access_token: 'new.jwt.token',
      }

      ;(mockAuthService.refreshToken as any).mockResolvedValue(expectedOutput)

      const result = await controller.refresh(validRefreshInput)

      expect(result).toEqual(expectedOutput)
      expect(mockAuthService.refreshToken).toHaveBeenCalledWith(validRefreshInput.refreshToken)
    })

    it('should propagate refresh token errors', async () => {
      const refreshError = new AuthServiceUnavailableError()
      ;(mockAuthService.refreshToken as any).mockRejectedValue(refreshError)

      await expect(controller.refresh(validRefreshInput)).rejects.toThrow(
        AuthServiceUnavailableError
      )
    })
  })

})
