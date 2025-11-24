import { HttpModule } from '@nestjs/axios'
import { Module } from '@nestjs/common'
import { EDITORIAL_SERVICE } from './contracts/editorial-service.contract'
import { EditorialController } from './editorial.controller'
import { EditorialService } from './editorial.service'

@Module({
  imports: [HttpModule],
  controllers: [EditorialController],
  providers: [{ provide: EDITORIAL_SERVICE, useClass: EditorialService }],
})
export class EditorialModule {}
