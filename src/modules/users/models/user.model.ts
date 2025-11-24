import { Field, ID, ObjectType } from '@nestjs/graphql'
import type { UserRole } from '../../auth/auth.types'

@ObjectType()
export class User {
  @Field(() => ID)
  id!: string

  @Field({ nullable: true })
  email?: string

  @Field(() => String)
  role!: UserRole

  @Field({ nullable: true })
  displayName?: string
}
