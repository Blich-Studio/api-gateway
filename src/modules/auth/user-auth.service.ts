import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as bcrypt from 'bcrypt'
import { randomUUID } from 'node:crypto'
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

    // Hash password
    const passwordHash = await this.hashPassword(password)

    try {
      // Create user - database constraint will prevent duplicates
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
    } catch (error: unknown) {
      // Handle race condition where duplicate email was inserted
      if (error instanceof Error && 'code' in error && error.code === '23505') {
        throw new ConflictException({
          code: 'EMAIL_ALREADY_IN_USE',
          message: 'A user with this email already exists',
        })
      }

      // Log unexpected database errors for debugging
      this.logger.error(
        'Unexpected error during user registration',
        error instanceof Error ? error.stack : error
      )
      throw error
    }
  }

  async verifyEmail(verifyDto: VerifyEmailDto): Promise<VerifyEmailResponse> {
    const { token } = verifyDto

    // Find all verification tokens for potential match (need to hash compare)
    const tokenQuery = `
      SELECT token, user_id, email, expires_at
      FROM verification_tokens
      WHERE expires_at > NOW()
    `
    const tokenResult = await this.postgresClient.query(tokenQuery)

    // Find matching token by comparing hashes
    let matchedToken: DbRow | null = null
    for (const row of tokenResult.rows) {
      const isMatch = await bcrypt.compare(token, row.token as string)
      if (isMatch) {
        matchedToken = row
        break
      }
    }

    if (!matchedToken) {
      throw new BadRequestException({
        code: 'INVALID_VERIFICATION_TOKEN',
        message: 'The verification token is invalid',
      })
    }

    // Update user verification status
    const updateQuery = `
      UPDATE users
      SET is_verified = true
      WHERE id = $1
      RETURNING id, email, is_verified
    `
    await this.postgresClient.query(updateQuery, [matchedToken.user_id])

    // Delete used token (delete by hash)
    await this.postgresClient.query('DELETE FROM verification_tokens WHERE token = $1', [
      matchedToken.token,
    ])

    this.logger.log(`Email verified successfully: ${matchedToken.email as string}`)

    return { message: 'Email verified successfully' }
  }

  async resendVerification(resendDto: ResendVerificationDto): Promise<ResendVerificationResponse> {
    const { email } = resendDto

    // Find user
    const user = await this.findUserByEmail(email)
    if (!user || user.isVerified) {
      // Return success to prevent email enumeration
      return {
        message: 'If this email is registered and unverified, a verification email has been sent',
      }
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
    const token = randomUUID()
    const tokenHash = await bcrypt.hash(token, 10) // Hash token for storage
    const expiryHours = this.configService.get<number>('VERIFICATION_TOKEN_EXPIRY_HOURS', 24)
    const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000)

    try {
      const query = `
        INSERT INTO verification_tokens (token, user_id, email, expires_at)
        VALUES ($1, $2, $3, $4)
        RETURNING token
      `
      await this.postgresClient.query(query, [tokenHash, userId, email, expiresAt])

      // Return unhashed token to send to user
      return token
    } catch (error: unknown) {
      this.logger.error(
        'Error creating verification token',
        error instanceof Error ? error.stack : error
      )
      throw error
    }
  }

  private async hashPassword(password: string): Promise<string> {
    const saltRounds = this.configService.get<number>('BCRYPT_SALT_ROUNDS', 12)
    return bcrypt.hash(password, saltRounds)
  }
}
