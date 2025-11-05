import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CmsProxyService } from './cms-proxy.service';

@ApiTags('CMS Content')
@Controller('content')
export class CmsProxyController {
  constructor(private cmsProxyService: CmsProxyService) {}

  @Get('games')
  @ApiOperation({ summary: 'Get all games from CMS' })
  getGames() {
    return this.cmsProxyService.getAssets();
  }

  @Get('games/:slug')
  @ApiOperation({ summary: 'Get single game from CMS' })
  getGame(@Param('slug') slug: string) {
    return this.cmsProxyService.getAssetBySlug(slug);
  }

  @Get('blog')
  @ApiOperation({ summary: 'Get all blog posts from CMS' })
  getBlogPosts() {
    return this.cmsProxyService.getBlogPosts();
  }

  @Get('blog/:slug')
  @ApiOperation({ summary: 'Get single blog post from CMS' })
  getBlogPost(@Param('slug') slug: string) {
    return this.cmsProxyService.getBlogPost(slug);
  }
}
