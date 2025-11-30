import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EmailService } from './email.service'

describe('EmailService', () => {
  let service: EmailService
  let configService: ConfigService

  beforeEach(async () => {
    configService = {
      get: vi.fn((key: string) => {
        const config: Record<string, any> = {
          APP_URL: 'http://localhost:3000',
          COMPANY_NAME: 'Test Company',
        }
        return config[key]
      }),
    } as unknown as ConfigService

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile()

    service = module.get<EmailService>(EmailService)
  })

  describe('sendVerificationEmail', () => {
    it('should call logger with email details', async () => {
      const loggerSpy = vi.spyOn(service['logger'], 'log')
      const emailData = {
        email: 'test@example.com',
        name: 'Test User',
        token: 'test-token-123',
      }

      await service.sendVerificationEmail(emailData)

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Preparing to send verification email')
      )

      loggerSpy.mockRestore()
    })

    it('should log verification URL in development mode', async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      const loggerSpy = vi.spyOn(service['logger'], 'log')
      const emailData = {
        email: 'test@example.com',
        name: 'Test User',
        token: 'test-token-12345678',
      }

      await service.sendVerificationEmail(emailData)

      const calls = loggerSpy.mock.calls.flat().join('\n')
      expect(calls).toContain('VERIFICATION EMAIL')
      expect(calls).toContain(emailData.email)

      loggerSpy.mockRestore()
      process.env.NODE_ENV = originalEnv
    })
  })
})
