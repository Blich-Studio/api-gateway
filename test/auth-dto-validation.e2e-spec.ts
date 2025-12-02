import { describe, it, expect } from 'vitest'
import { RegisterUserDto } from '../src/modules/auth/dto/register-user.dto'
import { VerifyEmailDto } from '../src/modules/auth/dto/verify-email.dto'
import { ResendVerificationDto } from '../src/modules/auth/dto/resend-verification.dto'
import { ZodValidationPipe } from 'nestjs-zod'

/**
 * Library-agnostic DTO validation tests
 * These tests verify that DTOs correctly accept or reject data based on business rules.
 * Tests use the validation pipe that would be used in production, ensuring consistent behavior.
 */
describe('Auth DTOs - Data Acceptance (Unit)', () => {
  const pipe = new ZodValidationPipe()

  /**
   * Helper to test if data passes validation
   */
  const expectValidData = async (DtoClass: any, data: any) => {
    await expect(pipe.transform(data, { type: 'body', metatype: DtoClass })).resolves.toBeDefined()
  }

  /**
   * Helper to test if data fails validation
   */
  const expectInvalidData = async (DtoClass: any, data: any) => {
    await expect(pipe.transform(data, { type: 'body', metatype: DtoClass })).rejects.toThrow()
  }
  describe('RegisterUserDto', () => {
    it('should accept valid registration data', async () => {
      const validData = {
        email: 'valid.user@example.com',
        password: 'StrongPass123!!',
        name: 'Valid User',
      }

      await expectValidData(RegisterUserDto, validData)
    })

    describe('email validation', () => {
      it('should reject when email is missing', async () => {
        const invalidData = {
          password: 'StrongPass123!!',
          name: 'User',
        }

        await expectInvalidData(RegisterUserDto, invalidData)
      })

      it('should reject when email is invalid format', async () => {
        const invalidData = {
          email: 'not-an-email',
          password: 'StrongPass123!!',
          name: 'User',
        }

        await expectInvalidData(RegisterUserDto, invalidData)
      })
    })

    describe('password validation', () => {
      it('should reject when password is too short', async () => {
        const invalidData = {
          email: 'user@example.com',
          password: 'Short1!',
          name: 'User',
        }

        await expectInvalidData(RegisterUserDto, invalidData)
      })

      it('should reject when password lacks uppercase letter', async () => {
        const invalidData = {
          email: 'user@example.com',
          password: 'weakpass123!',
          name: 'User',
        }

        await expectInvalidData(RegisterUserDto, invalidData)
      })

      it('should reject when password lacks lowercase letter', async () => {
        const invalidData = {
          email: 'user@example.com',
          password: 'WEAKPASS123!',
          name: 'User',
        }

        await expectInvalidData(RegisterUserDto, invalidData)
      })

      it('should reject when password lacks number', async () => {
        const invalidData = {
          email: 'user@example.com',
          password: 'WeakPassword!',
          name: 'User',
        }

        await expectInvalidData(RegisterUserDto, invalidData)
      })

      it('should reject when password lacks special character', async () => {
        const invalidData = {
          email: 'user@example.com',
          password: 'WeakPass123',
          name: 'User',
        }

        await expectInvalidData(RegisterUserDto, invalidData)
      })

      it('should accept passwords meeting all requirements', async () => {
        const validPasswords = ['StrongPass123!', 'MyP@ssw0rd', 'C0mpl3x!ty', 'Secur3$Pass']

        for (const password of validPasswords) {
          const validData = {
            email: 'user@example.com',
            password: password,
            name: 'User',
          }

          await expectValidData(RegisterUserDto, validData)
        }
      })
    })

    describe('name validation', () => {
      it('should reject when name is missing', async () => {
        const invalidData = {
          email: 'user@example.com',
          password: 'StrongPass123!!',
        }

        await expectInvalidData(RegisterUserDto, invalidData)
      })

      it('should reject when name is empty string', async () => {
        const invalidData = {
          email: 'user@example.com',
          password: 'StrongPass123!!',
          name: '',
        }

        await expectInvalidData(RegisterUserDto, invalidData)
      })

      it('should accept valid names', async () => {
        const validNames = ['John Doe', 'Jane Smith-Johnson', "O'Brien", 'Maria García', '李明']

        for (const name of validNames) {
          const validData = {
            email: 'user@example.com',
            password: 'StrongPass123!!',
            name: name,
          }

          await expectValidData(RegisterUserDto, validData)
        }
      })
    })
  })

  describe('VerifyEmailDto', () => {
    it('should accept valid token', async () => {
      const validData = {
        token: 'valid-token-string-123',
      }

      await expectValidData(VerifyEmailDto, validData)
    })

    it('should reject when token is missing', async () => {
      const invalidData = {}

      await expectInvalidData(VerifyEmailDto, invalidData)
    })

    it('should reject when token is empty', async () => {
      const invalidData = {
        token: '',
      }

      await expectInvalidData(VerifyEmailDto, invalidData)
    })
  })

  describe('ResendVerificationDto', () => {
    it('should accept valid email', async () => {
      const validData = {
        email: 'valid.user@example.com',
      }

      await expectValidData(ResendVerificationDto, validData)
    })

    it('should reject when email is missing', async () => {
      const invalidData = {}

      await expectInvalidData(ResendVerificationDto, invalidData)
    })

    it('should reject when email is invalid format', async () => {
      const invalidData = {
        email: 'not-valid-email',
      }

      await expectInvalidData(ResendVerificationDto, invalidData)
    })

    it('should accept various valid email formats', async () => {
      const validEmails = [
        'user@example.com',
        'user.name@example.com',
        'user+tag@example.co.uk',
        'user_name@sub.example.com',
      ]

      for (const email of validEmails) {
        const validData = { email }

        await expectValidData(ResendVerificationDto, validData)
      }
    })
  })
})
