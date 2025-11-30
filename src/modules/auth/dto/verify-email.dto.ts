import { ApiProperty } from '@nestjs/swagger'
import { IsString, MinLength } from 'class-validator'

export class VerifyEmailDto {
  @ApiProperty({
    description: 'Email verification token',
    example: 'abc123def456ghi789',
  })
  @IsString()
  @MinLength(1, { message: 'Token cannot be empty' })
  token!: string
}
