import { HttpModule } from '@nestjs/axios'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import configuration from './config/configuration'
import { CmsProxyModule } from './modules/cms-proxy/cms-proxy.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
    }),
    HttpModule,
    CmsProxyModule,
  ],
})
export class AppModule {}
