import { Controller, Get, Request, UseGuards } from '@nestjs/common'
import type { Request as ExpressRequest } from 'express'
import { JwtAuthGuard } from './modules/auth/jwt-auth.guard'

@Controller()
export class AppController {
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req: ExpressRequest & { user: unknown }) {
    return req.user
  }

  @Get('public')
  getPublic() {
    return { message: 'This is public' }
  }
}
