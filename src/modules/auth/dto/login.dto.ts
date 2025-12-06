import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

export class LoginDto extends createZodDto(LoginSchema) {}
