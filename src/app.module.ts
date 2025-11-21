import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default'
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo'
import { HttpModule } from '@nestjs/axios'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { GraphQLModule } from '@nestjs/graphql'
import { join } from 'path'

import configuration from './config/configuration'
import { AuthModule } from './modules/auth/auth.module'
// import { CmsProxyModule } from './modules/cms-proxy/cms-proxy.module'
import { AppController } from './app.controller'
import { ArticlesModule } from './modules/articles/articles.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      playground: false,
      csrfPrevention: false,
      plugins: [ApolloServerPluginLandingPageLocalDefault()],
    }),
    HttpModule,
    AuthModule,
    ArticlesModule,
    // CmsProxyModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
