import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

const VerifyEmailSchema = z.object({
  token: z.string().min(1, 'Token cannot be empty'),
})

export class VerifyEmailDto extends createZodDto(VerifyEmailSchema) {}
