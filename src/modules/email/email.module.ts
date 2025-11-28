import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { EmailService, EMAIL_SERVICE } from './email.service'

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: EMAIL_SERVICE,
      useClass: EmailService,
    },
  ],
  exports: [EMAIL_SERVICE],
})
export class EmailModule {}
