import { Field, InputType } from '@nestjs/graphql'
import { IsOptional, IsString } from 'class-validator'
import { AuthCredentialsWithRoleInput } from './base-auth.input'

@InputType()
export class RegisterUserInput extends AuthCredentialsWithRoleInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  displayName?: string
}
