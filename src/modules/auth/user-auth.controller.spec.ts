import { Test, TestingModule } from '@nestjs/testing'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UserAuthController } from './user-auth.controller'
import { UserAuthService } from './user-auth.service'

describe('UserAuthController', () => {
  let controller: UserAuthController
  let service: UserAuthService

  beforeEach(async () => {
    const mockService = {
      register: vi.fn(),
      verifyEmail: vi.fn(),
      resendVerification: vi.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserAuthController],
      providers: [
        {
          provide: UserAuthService,
          useValue: mockService,
        },
      ],
    }).compile()

    controller = module.get<UserAuthController>(UserAuthController)
    service = module.get<UserAuthService>(UserAuthService)
  })

  describe('register', () => {
    it('should call service.register with correct data', async () => {
      const registerDto = {
        email: 'test@example.com',
        password: 'StrongPass123!',
        nickname: 'testuser',
        firstName: 'Test',
        lastName: 'User',
      }

      const mockResponse = {
        id: 'user-123',
        email: registerDto.email,
        nickname: registerDto.nickname,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        isVerified: false,
        role: 'reader' as const,
        createdAt: new Date(),
      }

      vi.mocked(service.register).mockResolvedValue(mockResponse)

      const result = await controller.register(registerDto)

      expect(service.register).toHaveBeenCalledWith(registerDto)
      expect(result).toEqual(mockResponse)
    })
  })

  describe('verifyEmail', () => {
    it('should call service.verifyEmail with token', async () => {
      const verifyDto = { token: 'test-token-123' }
      const mockResponse = { message: 'Email verified successfully' }

      vi.mocked(service.verifyEmail).mockResolvedValue(mockResponse)

      const result = await controller.verifyEmail(verifyDto)

      expect(service.verifyEmail).toHaveBeenCalledWith(verifyDto)
      expect(result).toEqual(mockResponse)
    })
  })

  describe('resendVerification', () => {
    it('should call service.resendVerification with email', async () => {
      const resendDto = { email: 'test@example.com' }
      const mockResponse = {
        message: 'If this email is registered and unverified, a verification email has been sent',
      }

      vi.mocked(service.resendVerification).mockResolvedValue(mockResponse)

      const result = await controller.resendVerification(resendDto)

      expect(service.resendVerification).toHaveBeenCalledWith(resendDto)
      expect(result).toEqual(mockResponse)
    })
  })
})
