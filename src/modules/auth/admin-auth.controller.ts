import { Body, Controller, HttpCode, Post } from '@nestjs/common'
import { AdminAuthService } from './admin-auth.service'
import { AdminLoginDto } from './dto/admin-login.dto'

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Post('login')
  @HttpCode(200)
  login(@Body() credentials: AdminLoginDto) {
    return this.adminAuthService.login(credentials)
  }
}
