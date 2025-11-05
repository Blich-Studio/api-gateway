import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { CmsProxyService } from './cms-proxy.service';
import { CmsProxyController } from './cms-proxy.controller';

@Module({
  imports: [HttpModule, ConfigModule],
  controllers: [CmsProxyController],
  providers: [CmsProxyService],
})
export class CmsProxyModule {}
