import {
  Body,
  Controller,
  Delete,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import type { Request } from 'express'
import type { AuthenticatedUser } from '../auth/auth.types'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { Roles } from '../auth/roles.decorator'
import { RolesGuard } from '../auth/roles.guard'
import {
  EDITORIAL_SERVICE,
  type EditorialServiceContract,
} from './contracts/editorial-service.contract'
import { UpdateArticleDto } from './dto/update-article.dto'
import { UpdateCommentDto } from './dto/update-comment.dto'

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class EditorialController {
  constructor(
    @Inject(EDITORIAL_SERVICE) private readonly editorialService: EditorialServiceContract
  ) {}

  @Patch('articles/:articleId')
  @Roles('admin', 'writer')
  updateArticle(
    @Param('articleId') articleId: string,
    @Body() body: UpdateArticleDto,
    @Req() req: Request & { user: AuthenticatedUser }
  ) {
    return this.editorialService.updateArticle(articleId, body, req.user)
  }

  @Patch('comments/:commentId')
  @Roles('admin', 'writer', 'reader')
  updateComment(
    @Param('commentId') commentId: string,
    @Body() body: UpdateCommentDto,
    @Req() req: Request & { user: AuthenticatedUser }
  ) {
    return this.editorialService.updateComment(commentId, body, req.user)
  }

  @Delete('tags/:tagId')
  @Roles('admin')
  deleteTag(@Param('tagId') tagId: string, @Req() req: Request & { user: AuthenticatedUser }) {
    return this.editorialService.deleteTag(tagId, req.user)
  }

  @Post('tags')
  @Roles('admin')
  createTag(
    @Body() body: Record<string, unknown>,
    @Req() req: Request & { user: AuthenticatedUser }
  ) {
    return this.editorialService.createTag(body, req.user)
  }
}
