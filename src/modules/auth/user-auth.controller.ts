import { Body, Controller, Post } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { RegisterUserDto } from './dto/register-user.dto'
import { ResendVerificationDto } from './dto/resend-verification.dto'
import { VerifyEmailDto } from './dto/verify-email.dto'
import { UserAuthService } from './user-auth.service'

@ApiTags('auth')
@Controller('auth')
export class UserAuthController {
  constructor(private readonly userAuthService: UserAuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({
    status: 201,
    description: 'User successfully registered',
    schema: {
      example: {
        data: {
          id: 'user-123',
          email: 'user@example.com',
          name: 'John Doe',
          isVerified: false,
          createdAt: '2025-11-28T10:00:00.000Z',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error',
    schema: {
      example: {
        error: {
          message:
            'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
          statusCode: 400,
        },
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: 'Email already in use',
    schema: {
      example: {
        error: {
          code: 'EMAIL_ALREADY_IN_USE',
          message: 'A user with this email already exists',
          statusCode: 409,
        },
      },
    },
  })
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  async register(@Body() registerDto: RegisterUserDto) {
    return this.userAuthService.register(registerDto)
  }

  @Post('verify-email')
  @ApiOperation({ summary: 'Verify user email with token' })
  @ApiResponse({
    status: 200,
    description: 'Email successfully verified',
    schema: {
      example: {
        data: {
          message: 'Email verified successfully',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or expired token',
    schema: {
      examples: {
        invalid: {
          value: {
            error: {
              code: 'INVALID_VERIFICATION_TOKEN',
              message: 'The verification token is invalid',
              statusCode: 400,
            },
          },
        },
        expired: {
          value: {
            error: {
              code: 'VERIFICATION_TOKEN_EXPIRED',
              message: 'The verification token has expired',
              statusCode: 400,
            },
          },
        },
      },
    },
  })
  async verifyEmail(@Body() verifyDto: VerifyEmailDto) {
    return this.userAuthService.verifyEmail(verifyDto)
  }

  @Post('resend-verification')
  @ApiOperation({
    summary: 'Resend verification email',
    description:
      'Returns a generic success message regardless of whether the user exists or is already verified. ' +
      'This prevents email enumeration attacks. Legitimate users will receive an email only if their ' +
      'account exists and is unverified.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Generic success message (always returned to prevent email enumeration). ' +
      'Email is sent only if user exists and is unverified.',
    schema: {
      example: {
        data: {
          message: 'If this email is registered and unverified, a verification email has been sent',
        },
      },
    },
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 requests per minute
  async resendVerification(@Body() resendDto: ResendVerificationDto) {
    return this.userAuthService.resendVerification(resendDto)
  }
}
