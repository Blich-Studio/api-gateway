import { InputType } from '@nestjs/graphql'
import { AuthCredentialsInput } from './base-auth.input'

@InputType()
export class LoginUserInput extends AuthCredentialsInput {}
