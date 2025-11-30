import { validate } from 'class-validator'
import { describe, it, expect } from 'vitest'
import { ResendVerificationDto } from './resend-verification.dto'

describe('ResendVerificationDto', () => {
  it('should accept valid email', async () => {
    const dto = new ResendVerificationDto()
    dto.email = 'test@example.com'

    const errors = await validate(dto)
    expect(errors).toHaveLength(0)
  })

  it('should reject invalid email format', async () => {
    const dto = new ResendVerificationDto()
    dto.email = 'invalid-email'

    const errors = await validate(dto)
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0].property).toBe('email')
    expect(errors[0].constraints).toHaveProperty('isEmail')
  })

  it('should reject empty email', async () => {
    const dto = new ResendVerificationDto()
    dto.email = ''

    const errors = await validate(dto)
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0].property).toBe('email')
  })
})
