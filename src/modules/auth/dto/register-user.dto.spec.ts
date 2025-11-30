import { validate } from 'class-validator'
import { describe, it, expect } from 'vitest'
import { RegisterUserDto } from './register-user.dto'

describe('RegisterUserDto', () => {
  describe('email validation', () => {
    it('should accept valid email', async () => {
      const dto = new RegisterUserDto()
      dto.email = 'test@example.com'
      dto.password = 'StrongPass123!'
      dto.name = 'Test User'

      const errors = await validate(dto)
      expect(errors).toHaveLength(0)
    })

    it('should reject invalid email format', async () => {
      const dto = new RegisterUserDto()
      dto.email = 'invalid-email'
      dto.password = 'StrongPass123!'
      dto.name = 'Test User'

      const errors = await validate(dto)
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0].property).toBe('email')
      expect(errors[0].constraints).toHaveProperty('isEmail')
    })

    it('should reject empty email', async () => {
      const dto = new RegisterUserDto()
      dto.email = ''
      dto.password = 'StrongPass123!'
      dto.name = 'Test User'

      const errors = await validate(dto)
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0].property).toBe('email')
    })
  })

  describe('password validation', () => {
    it('should accept strong password', async () => {
      const dto = new RegisterUserDto()
      dto.email = 'test@example.com'
      dto.password = 'StrongPass123!'
      dto.name = 'Test User'

      const errors = await validate(dto)
      expect(errors).toHaveLength(0)
    })

    it('should reject password without uppercase letter', async () => {
      const dto = new RegisterUserDto()
      dto.email = 'test@example.com'
      dto.password = 'weakpass123!'
      dto.name = 'Test User'

      const errors = await validate(dto)
      expect(errors.length).toBeGreaterThan(0)
      const passwordError = errors.find((e) => e.property === 'password')
      expect(passwordError).toBeDefined()
      expect(passwordError?.constraints).toHaveProperty('matches')
    })

    it('should reject password without lowercase letter', async () => {
      const dto = new RegisterUserDto()
      dto.email = 'test@example.com'
      dto.password = 'WEAKPASS123!'
      dto.name = 'Test User'

      const errors = await validate(dto)
      expect(errors.length).toBeGreaterThan(0)
      const passwordError = errors.find((e) => e.property === 'password')
      expect(passwordError).toBeDefined()
    })

    it('should reject password without number', async () => {
      const dto = new RegisterUserDto()
      dto.email = 'test@example.com'
      dto.password = 'WeakPassword!'
      dto.name = 'Test User'

      const errors = await validate(dto)
      expect(errors.length).toBeGreaterThan(0)
      const passwordError = errors.find((e) => e.property === 'password')
      expect(passwordError).toBeDefined()
    })

    it('should reject password without special character', async () => {
      const dto = new RegisterUserDto()
      dto.email = 'test@example.com'
      dto.password = 'WeakPassword123'
      dto.name = 'Test User'

      const errors = await validate(dto)
      expect(errors.length).toBeGreaterThan(0)
      const passwordError = errors.find((e) => e.property === 'password')
      expect(passwordError).toBeDefined()
    })

    it('should reject password shorter than 8 characters', async () => {
      const dto = new RegisterUserDto()
      dto.email = 'test@example.com'
      dto.password = 'Short1!'
      dto.name = 'Test User'

      const errors = await validate(dto)
      expect(errors.length).toBeGreaterThan(0)
      const passwordError = errors.find((e) => e.property === 'password')
      expect(passwordError).toBeDefined()
      expect(passwordError?.constraints).toHaveProperty('minLength')
    })

    it('should reject empty password', async () => {
      const dto = new RegisterUserDto()
      dto.email = 'test@example.com'
      dto.password = ''
      dto.name = 'Test User'

      const errors = await validate(dto)
      expect(errors.length).toBeGreaterThan(0)
      expect(errors.find((e) => e.property === 'password')).toBeDefined()
    })
  })

  describe('name validation', () => {
    it('should accept valid name', async () => {
      const dto = new RegisterUserDto()
      dto.email = 'test@example.com'
      dto.password = 'StrongPass123!'
      dto.name = 'Test User'

      const errors = await validate(dto)
      expect(errors).toHaveLength(0)
    })

    it('should reject empty name', async () => {
      const dto = new RegisterUserDto()
      dto.email = 'test@example.com'
      dto.password = 'StrongPass123!'
      dto.name = ''

      const errors = await validate(dto)
      expect(errors.length).toBeGreaterThan(0)
      expect(errors.find((e) => e.property === 'name')).toBeDefined()
    })

    it('should trim whitespace from name', async () => {
      const dto = new RegisterUserDto()
      dto.email = 'test@example.com'
      dto.password = 'StrongPass123!'
      dto.name = '  Test User  '

      const errors = await validate(dto)
      expect(errors).toHaveLength(0)
    })
  })
})
