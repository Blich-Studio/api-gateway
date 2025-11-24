import { Field, InputType } from '@nestjs/graphql'
import { IsEmail, IsIn, IsOptional, IsString } from 'class-validator'
import type { UserRole } from '../../auth/auth.types'

const USER_ROLE_VALUES: UserRole[] = ['admin', 'writer', 'reader']

@InputType('CreateUserInput')
export class CreateUserInput {
  @Field()
  @IsString()
  externalId!: string

  @Field()
  @IsEmail()
  email!: string

  @Field()
  @IsIn(USER_ROLE_VALUES)
  role!: UserRole

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  displayName?: string
}

export class CreateUserDto extends CreateUserInput {}
