import { ApiProperty } from '@nestjs/swagger'
import { IsString } from 'class-validator'

export class VerifyEmailDto {
  @ApiProperty({
    description: 'Email verification token',
    example: 'abc123def456ghi789',
  })
  @IsString()
  token!: string
}
