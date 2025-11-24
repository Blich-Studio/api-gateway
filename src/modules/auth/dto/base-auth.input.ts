import { Field, InputType } from '@nestjs/graphql'
import { IsEmail, IsIn, IsString, MinLength } from 'class-validator'
import type { UserRole } from '../auth.types'

export const USER_ROLES: UserRole[] = ['admin', 'writer', 'reader']

@InputType({ isAbstract: true })
export class AuthCredentialsInput {
  @Field()
  @IsEmail()
  email!: string

  @Field()
  @IsString()
  @MinLength(8)
  password!: string
}

@InputType({ isAbstract: true })
export class AuthCredentialsWithRoleInput extends AuthCredentialsInput {
  @Field(() => String)
  @IsIn(USER_ROLES)
  role!: UserRole
}
