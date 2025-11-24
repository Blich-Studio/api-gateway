import { Field, ObjectType } from '@nestjs/graphql'
import { User } from '../../users/models/user.model'

@ObjectType()
export class AuthPayload {
  @Field()
  accessToken!: string

  @Field(() => User)
  user!: User
}
