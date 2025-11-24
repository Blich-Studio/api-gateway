import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import 'reflect-metadata'
import { AdminLoginDto } from './admin-login.dto'
import { LoginUserInput } from './login-user.input'
import { RegisterUserInput } from './register-user.input'

const expectValid = async (dto: object) => {
  const errors = await validate(dto)
  expect(errors).toHaveLength(0)
}

const expectInvalid = async (dto: object, property: string) => {
  const errors = await validate(dto)
  expect(errors).not.toHaveLength(0)
  expect(errors.some(err => err.property === property)).toBe(true)
}

describe('Auth DTO validation', () => {
  it('accepts a valid LoginUserInput payload', async () => {
    const dto = plainToInstance(LoginUserInput, {
      email: 'user@example.com',
      password: 'StrongPass123',
    })

    await expectValid(dto)
  })

  it('rejects login payloads with invalid email format', async () => {
    const dto = plainToInstance(LoginUserInput, {
      email: 'invalid-email',
      password: 'StrongPass123',
    })

    await expectInvalid(dto, 'email')
  })

  it('rejects login payloads with short passwords', async () => {
    const dto = plainToInstance(LoginUserInput, {
      email: 'user@example.com',
      password: 'short',
    })

    await expectInvalid(dto, 'password')
  })

  it('accepts valid register payloads with optional displayName', async () => {
    const dto = plainToInstance(RegisterUserInput, {
      email: 'writer@example.com',
      password: 'WriterPass123',
      role: 'writer',
      displayName: 'Writer W.',
    })

    await expectValid(dto)
  })

  it('rejects register payloads with unsupported roles', async () => {
    const dto = plainToInstance(RegisterUserInput, {
      email: 'reader@example.com',
      password: 'ReaderPass123',
      role: 'super-admin',
    })

    await expectInvalid(dto, 'role')
  })

  it('shares validation between AdminLoginDto and LoginUserInput', async () => {
    const dto = plainToInstance(AdminLoginDto, {
      email: 'admin@example.com',
      password: 'AdminPass123',
    })

    await expectValid(dto)

    const invalidDto = plainToInstance(AdminLoginDto, {
      email: 'admin@example.com',
      password: '123',
    })

    await expectInvalid(invalidDto, 'password')
  })
})
