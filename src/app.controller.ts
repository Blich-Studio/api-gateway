import { Controller, Get, Request, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from './modules/auth/jwt-auth.guard'

@Controller()
export class AppController {
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req) {
    return req.user
  }

  @Get('public')
  getPublic() {
    return { message: 'This is public' }
  }
}
