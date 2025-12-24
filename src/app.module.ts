import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { AuthModule } from './modules/auth/auth.module'
import { TagsModule } from './modules/tags/tags.module'
import { ArticlesModule } from './modules/articles/articles.module'
import { ProjectsModule } from './modules/projects/projects.module'
import { CommentsModule } from './modules/comments/comments.module'
import { LikesModule } from './modules/likes/likes.module'
import { UsersModule } from './modules/users/users.module'
import { UploadsModule } from './modules/uploads/uploads.module'
import { ActivityModule } from './modules/activity/activity.module'
import { ResponseInterceptor } from './common/interceptors/response.interceptor'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 seconds
        limit: 10, // Default limit for all routes
      },
    ]),
    AuthModule,
    TagsModule,
    ArticlesModule,
    ProjectsModule,
    CommentsModule,
    LikesModule,
    UsersModule,
    UploadsModule,
    ActivityModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
  ],
})
export class AppModule {}
