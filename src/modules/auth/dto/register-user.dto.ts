import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

const RegisterUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/,
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (non-alphanumeric, including underscore)'
    ),
  name: z.string().min(1, 'Name cannot be empty'),
})

export class RegisterUserDto extends createZodDto(RegisterUserSchema) {}
