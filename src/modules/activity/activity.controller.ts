import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { ActivityService } from './activity.service'
import { ActivityQueryDto } from './dto/activity.dto'

@ApiTags('activity')
@Controller('activity')
@Roles('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get()
  @ApiOperation({ summary: 'Get activity feed (admin only)' })
  @ApiResponse({ status: 200, description: 'Returns paginated activity feed' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin only' })
  async getActivityFeed(@Query() query: ActivityQueryDto) {
    return this.activityService.getActivityFeed(query)
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get activity statistics (admin only)' })
  @ApiResponse({ status: 200, description: 'Returns activity statistics' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin only' })
  async getStats() {
    return this.activityService.getStats()
  }

  @Get('comments')
  @ApiOperation({ summary: 'Get recent comments for moderation (admin only)' })
  @ApiResponse({ status: 200, description: 'Returns recent comments' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin only' })
  async getRecentComments(@Query('limit') limit?: number) {
    return this.activityService.getRecentComments(limit)
  }
}
