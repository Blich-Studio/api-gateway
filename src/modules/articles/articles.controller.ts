import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { ArticlesService } from './articles.service'
import { CreateArticleDto, UpdateArticleDto, ArticleQueryDto } from './dto/article.dto'

interface AuthUser {
  userId: string
  email: string
}

@ApiTags('articles')
@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get all articles' })
  @ApiResponse({ status: 200, description: 'Returns paginated articles' })
  async findAll(@Query() query: ArticleQueryDto, @CurrentUser() user?: AuthUser) {
    return this.articlesService.findAll(query, user?.userId)
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get an article by ID' })
  @ApiResponse({ status: 200, description: 'Returns the article' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  async findById(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user?: AuthUser) {
    return this.articlesService.findById(id, user?.userId)
  }

  @Get('slug/:slug')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get an article by slug' })
  @ApiResponse({ status: 200, description: 'Returns the article' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  async findBySlug(@Param('slug') slug: string, @CurrentUser() user?: AuthUser) {
    return this.articlesService.findBySlug(slug, user?.userId)
  }

  @Post()
  @Roles('writer', 'admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new article (writer/admin only)' })
  @ApiResponse({ status: 201, description: 'Article created successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 409, description: 'Article with this slug already exists' })
  async create(@Body() dto: CreateArticleDto, @CurrentUser() user: AuthUser) {
    return this.articlesService.create(dto, user.userId)
  }

  @Put(':id')
  @Roles('writer', 'admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an article (writer/admin only)' })
  @ApiResponse({ status: 200, description: 'Article updated successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions or not article owner' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateArticleDto,
    @CurrentUser() user: AuthUser
  ) {
    return this.articlesService.update(id, dto, user.userId)
  }

  @Delete(':id')
  @Roles('writer', 'admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an article (writer/admin only)' })
  @ApiResponse({ status: 200, description: 'Article deleted successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions or not article owner' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  async delete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    await this.articlesService.delete(id, user.userId)
    return { message: 'Article deleted successfully' }
  }

  @Post(':id/view')
  @ApiOperation({ summary: 'Increment article view count' })
  @ApiResponse({ status: 200, description: 'View count incremented' })
  async incrementViews(@Param('id', ParseUUIDPipe) id: string) {
    await this.articlesService.incrementViews(id)
    return { message: 'View count incremented' }
  }
}
