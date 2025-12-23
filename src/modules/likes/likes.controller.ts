import { Controller, Post, Delete, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { LikesService } from './likes.service'

interface AuthUser {
  userId: string
  email: string
}

@ApiTags('likes')
@Controller()
export class LikesController {
  constructor(private readonly likesService: LikesService) {}

  // ============ Article Likes ============

  @Post('articles/:id/like')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Like an article' })
  @ApiResponse({ status: 200, description: 'Article liked successfully' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  @ApiResponse({ status: 409, description: 'Article already liked' })
  async likeArticle(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.likesService.likeArticle(id, user.userId)
  }

  @Delete('articles/:id/like')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unlike an article' })
  @ApiResponse({ status: 200, description: 'Article unliked successfully' })
  @ApiResponse({ status: 404, description: 'Article or like not found' })
  async unlikeArticle(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.likesService.unlikeArticle(id, user.userId)
  }

  // ============ Project Likes ============

  @Post('projects/:id/like')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Like a project' })
  @ApiResponse({ status: 200, description: 'Project liked successfully' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 409, description: 'Project already liked' })
  async likeProject(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.likesService.likeProject(id, user.userId)
  }

  @Delete('projects/:id/like')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unlike a project' })
  @ApiResponse({ status: 200, description: 'Project unliked successfully' })
  @ApiResponse({ status: 404, description: 'Project or like not found' })
  async unlikeProject(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.likesService.unlikeProject(id, user.userId)
  }

  // ============ Comment Likes ============

  @Post('comments/:id/like')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Like a comment' })
  @ApiResponse({ status: 200, description: 'Comment liked successfully' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  @ApiResponse({ status: 409, description: 'Comment already liked' })
  async likeComment(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.likesService.likeComment(id, user.userId)
  }

  @Delete('comments/:id/like')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unlike a comment' })
  @ApiResponse({ status: 200, description: 'Comment unliked successfully' })
  @ApiResponse({ status: 404, description: 'Comment or like not found' })
  async unlikeComment(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.likesService.unlikeComment(id, user.userId)
  }
}
