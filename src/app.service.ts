import { Injectable } from '@nestjs/common'

@Injectable()
export class AppService {
  getHello(): { message: string; time: string } {
    return { message: `Welcome to the Blich API Gateway!`, time: new Date().toISOString() }
  }
}
