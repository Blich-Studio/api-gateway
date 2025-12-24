import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { MulterModule } from '@nestjs/platform-express'
import { PostgresModule } from '../database/postgres.module'
import { UploadsService } from './uploads.service'
import { UploadsController } from './uploads.controller'
import { RolesGuard } from '../auth/guards/roles.guard'

@Module({
  imports: [
    ConfigModule,
    PostgresModule,
    MulterModule.register({
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
  ],
  providers: [UploadsService, RolesGuard],
  controllers: [UploadsController],
  exports: [UploadsService],
})
export class UploadsModule {}
