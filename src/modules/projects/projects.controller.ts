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
import { ProjectsService } from './projects.service'
import { CreateProjectDto, UpdateProjectDto, ProjectQueryDto } from './dto/project.dto'

interface AuthUser {
  userId: string
  email: string
}

@ApiTags('projects')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get all projects' })
  @ApiResponse({ status: 200, description: 'Returns paginated projects' })
  async findAll(@Query() query: ProjectQueryDto, @CurrentUser() user?: AuthUser) {
    return this.projectsService.findAll(query, user?.userId)
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get a project by ID' })
  @ApiResponse({ status: 200, description: 'Returns the project' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async findById(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user?: AuthUser) {
    return this.projectsService.findById(id, user?.userId)
  }

  @Get('slug/:slug')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get a project by slug' })
  @ApiResponse({ status: 200, description: 'Returns the project' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async findBySlug(@Param('slug') slug: string, @CurrentUser() user?: AuthUser) {
    return this.projectsService.findBySlug(slug, user?.userId)
  }

  @Post()
  @Roles('writer', 'admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new project (writer/admin only)' })
  @ApiResponse({ status: 201, description: 'Project created successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 409, description: 'Project with this slug already exists' })
  async create(@Body() dto: CreateProjectDto, @CurrentUser() user: AuthUser) {
    return this.projectsService.create(dto, user.userId)
  }

  @Put(':id')
  @Roles('writer', 'admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a project (writer/admin only)' })
  @ApiResponse({ status: 200, description: 'Project updated successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions or not project owner' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() user: AuthUser
  ) {
    return this.projectsService.update(id, dto, user.userId)
  }

  @Delete(':id')
  @Roles('writer', 'admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a project (writer/admin only)' })
  @ApiResponse({ status: 200, description: 'Project deleted successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions or not project owner' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async delete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    await this.projectsService.delete(id, user.userId)
    return { message: 'Project deleted successfully' }
  }

  @Post(':id/view')
  @ApiOperation({ summary: 'Increment project view count' })
  @ApiResponse({ status: 200, description: 'View count incremented' })
  async incrementViews(@Param('id', ParseUUIDPipe) id: string) {
    await this.projectsService.incrementViews(id)
    return { message: 'View count incremented' }
  }
}
