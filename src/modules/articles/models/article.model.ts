import { Field, ID, ObjectType } from '@nestjs/graphql'

@ObjectType()
export class Article {
  @Field(() => ID)
  id: string

  @Field()
  title: string

  @Field()
  content: string

  @Field()
  slug: string

  @Field()
  perex: string

  @Field()
  status: string

  @Field()
  createdAt: number

  @Field()
  updatedAt: number
}
