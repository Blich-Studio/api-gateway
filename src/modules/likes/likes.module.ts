import { Module } from '@nestjs/common'
import { PostgresModule } from '../database/postgres.module'
import { LikesController } from './likes.controller'
import { LikesService } from './likes.service'

@Module({
  imports: [PostgresModule],
  controllers: [LikesController],
  providers: [LikesService],
  exports: [LikesService],
})
export class LikesModule {}
