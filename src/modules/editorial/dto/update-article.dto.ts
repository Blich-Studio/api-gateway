import {
  IsArray,
  IsIn,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator'

type ArticleStatus = 'draft' | 'published' | 'archived'

const ARTICLE_STATUSES: ArticleStatus[] = ['draft', 'published', 'archived']

export class UpdateArticleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string

  @IsOptional()
  @IsString()
  @MinLength(1)
  content?: string

  @IsOptional()
  @IsMongoId()
  authorId?: string

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  slug?: string

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  perex?: string

  @IsOptional()
  @IsIn(ARTICLE_STATUSES)
  status?: ArticleStatus

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[]
}
