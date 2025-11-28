import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as crypto from 'node:crypto'
import type { RegisterUserDto } from './dto/register-user.dto'
import type { ResendVerificationDto } from './dto/resend-verification.dto'
import type { VerifyEmailDto } from './dto/verify-email.dto'
import type {
  RegisterResponse,
  ResendVerificationResponse,
  UserWithPassword,
  VerifyEmailResponse,
} from './interfaces/user-auth.interface'

type DbRow = Record<string, unknown>

interface PostgresClient {
  query(text: string, params?: unknown[]): Promise<{ rows: DbRow[]; rowCount: number }>
}

interface EmailService {
  sendVerificationEmail(data: { email: string; name: string; token: string }): Promise<void>
}

@Injectable()
export class UserAuthService {
  private readonly logger = new Logger(UserAuthService.name)

  constructor(
    private readonly postgresClient: PostgresClient,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService
  ) {}

  async register(registerDto: RegisterUserDto): Promise<RegisterResponse> {
    const { email, password, name } = registerDto

    // Check if user already exists
    const existingUser = await this.findUserByEmail(email)
    if (existingUser) {
      throw new ConflictException({
        code: 'EMAIL_ALREADY_IN_USE',
        message: 'A user with this email already exists',
      })
    }

    // Hash password
    const passwordHash = this.hashPassword(password)

    // Create user
    const query = `
      INSERT INTO users (email, name, password_hash, is_verified, created_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, email, name, is_verified, created_at
    `
    const result = await this.postgresClient.query(query, [
      email,
      name,
      passwordHash,
      false,
      new Date(),
    ])

    const [user] = result.rows

    // Generate verification token
    const verificationToken = await this.createVerificationToken(user.id as string, email)

    // Send verification email
    await this.emailService.sendVerificationEmail({
      email,
      name,
      token: verificationToken,
    })

    this.logger.log(`User registered successfully: ${email}`)

    return {
      id: user.id as string,
      email: user.email as string,
      name: user.name as string,
      isVerified: user.is_verified as boolean,
      createdAt: user.created_at as Date,
    }
  }

  async verifyEmail(verifyDto: VerifyEmailDto): Promise<VerifyEmailResponse> {
    const { token } = verifyDto

    // Find verification token
    const tokenQuery = `
      SELECT token, user_id, email, expires_at
      FROM verification_tokens
      WHERE token = $1
    `
    const tokenResult = await this.postgresClient.query(tokenQuery, [token])

    if (tokenResult.rowCount === 0) {
      throw new BadRequestException({
        code: 'INVALID_VERIFICATION_TOKEN',
        message: 'The verification token is invalid',
      })
    }

    const [verificationToken] = tokenResult.rows

    // Check if token is expired
    if (new Date(verificationToken.expires_at as string) < new Date()) {
      throw new BadRequestException({
        code: 'VERIFICATION_TOKEN_EXPIRED',
        message: 'The verification token has expired',
      })
    }

    // Update user verification status
    const updateQuery = `
      UPDATE users
      SET is_verified = true
      WHERE id = $1
      RETURNING id, email, is_verified
    `
    await this.postgresClient.query(updateQuery, [verificationToken.user_id as string])

    // Delete used token
    await this.postgresClient.query('DELETE FROM verification_tokens WHERE token = $1', [token])

    this.logger.log(`Email verified successfully: ${verificationToken.email as string}`)

    return { message: 'Email verified successfully' }
  }

  async resendVerification(resendDto: ResendVerificationDto): Promise<ResendVerificationResponse> {
    const { email } = resendDto

    // Find user
    const user = await this.findUserByEmail(email)
    if (!user) {
      throw new BadRequestException({
        code: 'USER_NOT_FOUND',
        message: 'No user found with this email',
      })
    }

    if (user.isVerified) {
      throw new BadRequestException({
        code: 'USER_ALREADY_VERIFIED',
        message: 'This email is already verified',
      })
    }

    // Delete old verification tokens
    await this.postgresClient.query('DELETE FROM verification_tokens WHERE user_id = $1', [user.id])

    // Generate new verification token
    const verificationToken = await this.createVerificationToken(user.id, email)

    // Send verification email
    await this.emailService.sendVerificationEmail({
      email,
      name: user.name,
      token: verificationToken,
    })

    this.logger.log(`Verification email resent to: ${email}`)

    return { message: 'Verification email sent successfully' }
  }

  private async findUserByEmail(email: string): Promise<UserWithPassword | null> {
    const query = `
      SELECT id, email, name, password_hash, is_verified, created_at
      FROM users
      WHERE email = $1
    `
    const result = await this.postgresClient.query(query, [email])

    if (result.rowCount === 0) {
      return null
    }

    const [row] = result.rows

    return {
      id: row.id as string,
      email: row.email as string,
      name: row.name as string,
      passwordHash: row.password_hash as string,
      isVerified: row.is_verified as boolean,
      createdAt: row.created_at as Date,
    }
  }

  private async createVerificationToken(userId: string, email: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    const query = `
      INSERT INTO verification_tokens (token, user_id, email, expires_at)
      VALUES ($1, $2, $3, $4)
      RETURNING token
    `
    const result = await this.postgresClient.query(query, [token, userId, email, expiresAt])

    return result.rows[0]?.token as string
  }

  private hashPassword(password: string): string {
    // In production, use bcrypt or similar
    // This is a simplified version for demonstration
    return crypto.createHash('sha256').update(password).digest('hex')
  }
}
