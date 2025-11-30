import { validate } from 'class-validator'
import { RegisterUserDto } from '../src/modules/auth/dto/register-user.dto'
import { ResendVerificationDto } from '../src/modules/auth/dto/resend-verification.dto'
import { VerifyEmailDto } from '../src/modules/auth/dto/verify-email.dto'

describe('Auth DTOs Validation (Unit Tests)', () => {
  describe('RegisterUserDto', () => {
    it('should pass validation with valid data', async () => {
      const dto = new RegisterUserDto()
      dto.email = 'valid.user@example.com'
      dto.password = 'StrongPass123!!'
      dto.name = 'Valid User'

      const errors = await validate(dto)
      expect(errors.length).toBe(0)
    })

    describe('email validation', () => {
      it('should fail when email is missing', async () => {
        const dto = new RegisterUserDto()
        dto.password = 'StrongPass123!!'
        dto.name = 'User'

        const errors = await validate(dto)
        expect(errors.length).toBeGreaterThan(0)
        expect(errors.some(e => e.property === 'email')).toBe(true)
      })

      it('should fail when email is invalid format', async () => {
        const dto = new RegisterUserDto()
        dto.email = 'not-an-email'
        dto.password = 'StrongPass123!!'
        dto.name = 'User'

        const errors = await validate(dto)
        expect(errors.length).toBeGreaterThan(0)
        expect(errors.some(e => e.property === 'email')).toBe(true)
      })
    })

    describe('password validation', () => {
      it('should fail when password is too short', async () => {
        const dto = new RegisterUserDto()
        dto.email = 'user@example.com'
        dto.password = 'Short1!'
        dto.name = 'User'

        const errors = await validate(dto)
        expect(errors.length).toBeGreaterThan(0)
        const passwordError = errors.find(e => e.property === 'password')
        expect(passwordError).toBeDefined()
        expect(passwordError?.constraints).toHaveProperty('minLength')
      })

      it('should fail when password lacks uppercase letter', async () => {
        const dto = new RegisterUserDto()
        dto.email = 'user@example.com'
        dto.password = 'weakpass123!'
        dto.name = 'User'

        const errors = await validate(dto)
        expect(errors.length).toBeGreaterThan(0)
        const passwordError = errors.find(e => e.property === 'password')
        expect(passwordError).toBeDefined()
        expect(passwordError?.constraints).toHaveProperty('matches')
      })

      it('should fail when password lacks lowercase letter', async () => {
        const dto = new RegisterUserDto()
        dto.email = 'user@example.com'
        dto.password = 'WEAKPASS123!'
        dto.name = 'User'

        const errors = await validate(dto)
        expect(errors.length).toBeGreaterThan(0)
        const passwordError = errors.find(e => e.property === 'password')
        expect(passwordError).toBeDefined()
        expect(passwordError?.constraints).toHaveProperty('matches')
      })

      it('should fail when password lacks number', async () => {
        const dto = new RegisterUserDto()
        dto.email = 'user@example.com'
        dto.password = 'WeakPassword!'
        dto.name = 'User'

        const errors = await validate(dto)
        expect(errors.length).toBeGreaterThan(0)
        const passwordError = errors.find(e => e.property === 'password')
        expect(passwordError).toBeDefined()
        expect(passwordError?.constraints).toHaveProperty('matches')
      })

      it('should fail when password lacks special character', async () => {
        const dto = new RegisterUserDto()
        dto.email = 'user@example.com'
        dto.password = 'WeakPass123'
        dto.name = 'User'

        const errors = await validate(dto)
        expect(errors.length).toBeGreaterThan(0)
        const passwordError = errors.find(e => e.property === 'password')
        expect(passwordError).toBeDefined()
        expect(passwordError?.constraints).toHaveProperty('matches')
      })

      it('should pass with all password requirements met', async () => {
        const validPasswords = ['StrongPass123!', 'MyP@ssw0rd', 'C0mpl3x!ty', 'Secur3$Pass']

        for (const password of validPasswords) {
          const dto = new RegisterUserDto()
          dto.email = 'user@example.com'
          dto.password = password
          dto.name = 'User'

          const errors = await validate(dto)
          const passwordError = errors.find(e => e.property === 'password')
          expect(passwordError).toBeUndefined()
        }
      })
    })

    describe('name validation', () => {
      it('should fail when name is missing', async () => {
        const dto = new RegisterUserDto()
        dto.email = 'user@example.com'
        dto.password = 'StrongPass123!!'

        const errors = await validate(dto)
        expect(errors.length).toBeGreaterThan(0)
        expect(errors.some(e => e.property === 'name')).toBe(true)
      })

      it('should fail when name is empty string', async () => {
        const dto = new RegisterUserDto()
        dto.email = 'user@example.com'
        dto.password = 'StrongPass123!!'
        dto.name = ''

        const errors = await validate(dto)
        expect(errors.length).toBeGreaterThan(0)
        const nameError = errors.find(e => e.property === 'name')
        expect(nameError).toBeDefined()
      })

      it('should pass with valid name', async () => {
        const validNames = ['John Doe', 'Jane Smith-Johnson', "O'Brien", 'Maria García', '李明']

        for (const name of validNames) {
          const dto = new RegisterUserDto()
          dto.email = 'user@example.com'
          dto.password = 'StrongPass123!!'
          dto.name = name

          const errors = await validate(dto)
          const nameError = errors.find(e => e.property === 'name')
          expect(nameError).toBeUndefined()
        }
      })
    })
  })

  describe('VerifyEmailDto', () => {
    it('should pass validation with valid token', async () => {
      const dto = new VerifyEmailDto()
      dto.token = 'valid-token-string-123'

      const errors = await validate(dto)
      expect(errors.length).toBe(0)
    })

    it('should fail when token is missing', async () => {
      const dto = new VerifyEmailDto()

      const errors = await validate(dto)
      expect(errors.length).toBeGreaterThan(0)
      expect(errors.some(e => e.property === 'token')).toBe(true)
    })

    it('should fail when token is not a string', async () => {
      const dto = new VerifyEmailDto()
      // @ts-expect-error Testing invalid type
      dto.token = 12345

      const errors = await validate(dto)
      expect(errors.length).toBeGreaterThan(0)
      expect(errors.some(e => e.property === 'token')).toBe(true)
    })
  })

  describe('ResendVerificationDto', () => {
    it('should pass validation with valid email', async () => {
      const dto = new ResendVerificationDto()
      dto.email = 'valid.user@example.com'

      const errors = await validate(dto)
      expect(errors.length).toBe(0)
    })

    it('should fail when email is missing', async () => {
      const dto = new ResendVerificationDto()

      const errors = await validate(dto)
      expect(errors.length).toBeGreaterThan(0)
      expect(errors.some(e => e.property === 'email')).toBe(true)
    })

    it('should fail when email is invalid format', async () => {
      const dto = new ResendVerificationDto()
      dto.email = 'not-valid-email'

      const errors = await validate(dto)
      expect(errors.length).toBeGreaterThan(0)
      expect(errors.some(e => e.property === 'email')).toBe(true)
    })

    it('should pass with various valid email formats', async () => {
      const validEmails = [
        'user@example.com',
        'user.name@example.com',
        'user+tag@example.co.uk',
        'user_name@sub.example.com',
      ]

      for (const email of validEmails) {
        const dto = new ResendVerificationDto()
        dto.email = email

        const errors = await validate(dto)
        expect(errors.length).toBe(0)
      }
    })
  })
})
