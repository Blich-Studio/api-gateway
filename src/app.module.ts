import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { AppConfig, AppConfigModule } from './common/config'
import { AuthModule } from './modules/auth/auth.module'
import { TagsModule } from './modules/tags/tags.module'
import { ArticlesModule } from './modules/articles/articles.module'
import { ProjectsModule } from './modules/projects/projects.module'
import { CommentsModule } from './modules/comments/comments.module'
import { LikesModule } from './modules/likes/likes.module'
import { UsersModule } from './modules/users/users.module'
import { UploadsModule } from './modules/uploads/uploads.module'
import { ActivityModule } from './modules/activity/activity.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AppConfigModule,
    ThrottlerModule.forRoot([
      {
        ttl: AppConfig.RATE_LIMIT_TTL,
        limit: AppConfig.RATE_LIMIT_DEFAULT,
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
  ],
})
export class AppModule {}
