import { ApiProperty } from '@nestjs/swagger'
import { IsEmail, IsString, Matches, MinLength } from 'class-validator'

export class RegisterUserDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsEmail()
  email!: string

  @ApiProperty({
    description:
      'User password (min 8 characters, must contain uppercase, lowercase, number, and special character)',
    example: 'StrongPass123!!',
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  password!: string

  @ApiProperty({
    description: 'User display name',
    example: 'John Doe',
  })
  @IsString()
  @MinLength(1, { message: 'Name cannot be empty' })
  name!: string
}
