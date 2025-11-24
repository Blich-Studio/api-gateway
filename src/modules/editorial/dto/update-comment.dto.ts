import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class UpdateCommentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  content?: string

  @IsOptional()
  @IsString()
  @MaxLength(50)
  status?: string
}
