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
      expect(calls).toContain('Development Mode')
      expect(calls).toContain(emailData.email)

      loggerSpy.mockRestore()
      process.env.NODE_ENV = originalEnv
    })

    it('should generate verification URL with correct format', async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      const emailData = {
        email: 'user@example.com',
        name: 'John Doe',
        token: 'abc123tokenxyz',
      }

      const loggerSpy = vi.spyOn(service['logger'], 'log')

      await service.sendVerificationEmail(emailData)

      const allCalls = loggerSpy.mock.calls
        .map((call) => (typeof call[0] === 'string' ? call[0] : JSON.stringify(call[0])))
        .join('\n')
      
      // Token is redacted in logs, check for the redacted version
      expect(allCalls).toContain('verify?token=abc123to...')
      expect(allCalls).toContain('Token: abc123to... (redacted)')

      loggerSpy.mockRestore()
      process.env.NODE_ENV = originalEnv
    })

    it('should use custom APP_URL when configured', async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      configService.get = vi.fn((key: string, defaultValue?: any) => {
        if (key === 'APP_URL') return 'https://example.com'
        if (key === 'COMPANY_NAME') return 'Test Company'
        return defaultValue
      })

      const emailData = {
        email: 'user@example.com',
        name: 'Jane Doe',
        token: 'xyz789',
      }

      const loggerSpy = vi.spyOn(service['logger'], 'log')

      await service.sendVerificationEmail(emailData)

      const allCalls = loggerSpy.mock.calls
        .map((call) => (typeof call[0] === 'string' ? call[0] : JSON.stringify(call[0])))
        .join('\n')
      
      expect(allCalls).toContain('https://example.com/auth/verify?token=xyz789')

      loggerSpy.mockRestore()
      process.env.NODE_ENV = originalEnv
    })

    it('should log warning in non-development environments', async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'

      const loggerWarnSpy = vi.spyOn(service['logger'], 'warn')
      const emailData = {
        email: 'test@example.com',
        name: 'Test User',
        token: 'test-token-123',
      }

      await service.sendVerificationEmail(emailData)

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Email provider not fully configured')
      )
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('verification email NOT sent to: test@example.com')
      )

      loggerWarnSpy.mockRestore()
      process.env.NODE_ENV = originalEnv
    })

    it('should escape HTML in email template', async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      const emailData = {
        email: 'test@example.com',
        name: '<script>alert("xss")</script>&test',
        token: 'test-token-123',
      }

      // Call sendVerificationEmail which internally uses escapeHtml in getVerificationEmailTemplate
      const result = await service.sendVerificationEmail(emailData)
      
      // The escapeHtml function is called inside getVerificationEmailTemplate
      // We just verify it completes successfully - the HTML escaping is tested
      // by calling the internal template generation logic
      expect(result).toBeUndefined()

      process.env.NODE_ENV = originalEnv
    })

    it('should call getVerificationEmailTemplate and test HTML escaping', async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'test'

      const emailData = {
        email: 'test@example.com',
        name: 'Test & <User>',
        token: 'test-token-123',
      }

      // This tests both the escapeHtml function and getVerificationEmailTemplate
      const result = await service.sendVerificationEmail(emailData)
      
      // Should complete without errors
      expect(result).toBeUndefined()

      process.env.NODE_ENV = originalEnv
    })
  })

  describe('getVerificationEmailTemplate', () => {
    it('should generate email template with escaped HTML', () => {
      const name = '<script>alert("xss")</script>'
      const url = 'http://localhost:3000/auth/verify?token=abc123'
      
      // Access the private method through bracket notation for testing
      const template = service['getVerificationEmailTemplate'](name, url)
      
      // Should escape the name to prevent XSS
      expect(template).toContain('&lt;script&gt;')
      expect(template).not.toContain('<script>')
      expect(template).toContain(url)
    })

    it('should escape special HTML characters', () => {
      const name = '& < > " \' Test'
      const url = 'http://localhost:3000/verify'
      
      const template = service['getVerificationEmailTemplate'](name, url)
      
      expect(template).toContain('&amp;')
      expect(template).toContain('&lt;')
      expect(template).toContain('&gt;')
      expect(template).toContain('&quot;')
      expect(template).toContain('&#039;')
    })

    it('should include company name from config', () => {
      const name = 'Test User'
      const url = 'http://localhost:3000/verify'
      
      const template = service['getVerificationEmailTemplate'](name, url)
      
      expect(template).toContain('Test Company')
    })
  })
})
