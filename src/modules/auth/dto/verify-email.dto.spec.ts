import { validate } from 'class-validator'
import { describe, it, expect } from 'vitest'
import { VerifyEmailDto } from './verify-email.dto'

describe('VerifyEmailDto', () => {
  it('should accept valid token', async () => {
    const dto = new VerifyEmailDto()
    dto.token = 'valid-token-123456789'

    const errors = await validate(dto)
    expect(errors).toHaveLength(0)
  })

  it('should accept empty string token (no length validation)', async () => {
    const dto = new VerifyEmailDto()
    dto.token = ''

    const errors = await validate(dto)
    expect(errors).toHaveLength(0)
  })

  it('should reject undefined token', async () => {
    const dto = new VerifyEmailDto()

    const errors = await validate(dto)
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0].property).toBe('token')
  })
})
