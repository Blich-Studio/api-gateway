import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { AuthService } from '../services/auth.service'
import { JwtAuthGuard } from '../guards/jwt-auth.guard'
import { CurrentUser } from '../decorators/current-user.decorator'
import { LoginDto } from '../dto/login.dto'
import { RefreshTokenDto } from '../dto/refresh-token.dto'

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({
    status: 200,
    description: 'Successfully logged in',
    schema: {
      example: {
        access_token: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
        user: {
          id: 'user-123',
          email: 'user@example.com',
          name: 'John Doe',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials or email not verified',
    schema: {
      example: {
        statusCode: 401,
        message: 'Invalid credentials',
        error: 'Unauthorized',
      },
    },
  })
  @Throttle({ default: { limit: 5, ttl: 60 } }) // 5 requests per 60 seconds
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto.email, loginDto.password)
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiResponse({
    status: 200,
    description: 'New access token generated',
    schema: {
      example: {
        access_token: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired refresh token',
    schema: {
      example: {
        statusCode: 401,
        message: 'Invalid or expired refresh token',
        error: 'Unauthorized',
      },
    },
  })
  @Throttle({ default: { limit: 10, ttl: 60 } }) // 10 requests per 60 seconds
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto.refreshToken)
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'Current user profile',
    schema: {
      example: {
        userId: 'user-123',
        email: 'user@example.com',
        name: 'John Doe',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  getProfile(@CurrentUser() user: { userId: string; email: string; name?: string }) {
    return user
  }
}
