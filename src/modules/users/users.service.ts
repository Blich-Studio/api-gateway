import { Inject, Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common'
import * as bcrypt from 'bcrypt'
import { POSTGRES_CLIENT, type PostgresClient } from '../database/postgres.module'
import { EMAIL_SERVICE } from '../email/email.service'
import type {
  UserQueryDto,
  UpdateUserRoleDto,
  UpdateUserVerificationDto,
  ResetPasswordDto,
  UserRole,
} from './dto/user.dto'

interface EmailService {
  sendEmail(data: { to: string; subject: string; text: string; html: string }): Promise<void>
}

interface UserRow {
  id: string
  email: string
  nickname: string
  first_name: string | null
  last_name: string | null
  role: UserRole
  is_verified: boolean
  avatar_url: string | null
  created_at: Date
  last_login_at: Date | null
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name)
  private readonly SALT_ROUNDS = 12

  constructor(
    @Inject(POSTGRES_CLIENT) private readonly db: PostgresClient,
    @Inject(EMAIL_SERVICE) private readonly emailService: EmailService
  ) {}

  /**
   * Get paginated list of users (admin only)
   */
  async findAll(query: UserQueryDto) {
    const { role, isVerified, search, page, limit, sort, order } = query

    const conditions: string[] = []
    const params: unknown[] = []
    let paramIndex = 1

    if (role) {
      conditions.push(`role = $${paramIndex++}`)
      params.push(role)
    }

    if (isVerified !== undefined) {
      conditions.push(`is_verified = $${paramIndex++}`)
      params.push(isVerified)
    }

    if (search) {
      conditions.push(`(
        email ILIKE $${paramIndex} OR 
        nickname ILIKE $${paramIndex} OR 
        first_name ILIKE $${paramIndex} OR 
        last_name ILIKE $${paramIndex}
      )`)
      params.push(`%${search}%`)
      paramIndex++
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Map sort field to column name
    const sortColumn: Record<string, string> = {
      createdAt: 'created_at',
      email: 'email',
      nickname: 'nickname',
      lastLoginAt: 'last_login_at',
    }
    const orderColumn = sortColumn[sort] || 'created_at'

    // Count total
    const countQuery = `SELECT COUNT(*) as total FROM users ${whereClause}`
    const countResult = await this.db.query(countQuery, params)
    const total = Number(countResult.rows[0]?.total ?? 0)

    // Fetch paginated users
    const offset = (page - 1) * limit
    const dataQuery = `
      SELECT id, email, nickname, first_name, last_name, role, is_verified, avatar_url, created_at, last_login_at
      FROM users
      ${whereClause}
      ORDER BY ${orderColumn} ${order.toUpperCase()}
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `
    params.push(limit, offset)

    const result = await this.db.query(dataQuery, params)
    const users = (result.rows as unknown as UserRow[]).map(row => this.mapUserRow(row))

    const totalPages = Math.ceil(total / limit)

    return {
      data: users,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    }
  }

  /**
   * Get a single user by ID (admin only)
   */
  async findById(id: string) {
    const query = `
      SELECT id, email, nickname, first_name, last_name, role, is_verified, avatar_url, created_at, last_login_at
      FROM users
      WHERE id = $1
    `
    const result = await this.db.query(query, [id])

    if (result.rows.length === 0) {
      throw new NotFoundException(`User with ID ${id} not found`)
    }

    return { data: this.mapUserRow(result.rows[0] as unknown as UserRow) }
  }

  /**
   * Update user role (admin only)
   */
  async updateRole(id: string, dto: UpdateUserRoleDto, adminUserId: string) {
    // Prevent admin from changing their own role
    if (id === adminUserId) {
      throw new ForbiddenException('You cannot change your own role')
    }

    const query = `
      UPDATE users
      SET role = $1
      WHERE id = $2
      RETURNING id, email, nickname, first_name, last_name, role, is_verified, avatar_url, created_at, last_login_at
    `
    const result = await this.db.query(query, [dto.role, id])

    if (result.rows.length === 0) {
      throw new NotFoundException(`User with ID ${id} not found`)
    }

    this.logger.log(`Admin ${adminUserId} changed user ${id} role to ${dto.role}`)

    return { data: this.mapUserRow(result.rows[0] as unknown as UserRow) }
  }

  /**
   * Update user verification status (admin only)
   */
  async updateVerification(id: string, dto: UpdateUserVerificationDto) {
    const query = `
      UPDATE users
      SET is_verified = $1
      WHERE id = $2
      RETURNING id, email, nickname, first_name, last_name, role, is_verified, avatar_url, created_at, last_login_at
    `
    const result = await this.db.query(query, [dto.isVerified, id])

    if (result.rows.length === 0) {
      throw new NotFoundException(`User with ID ${id} not found`)
    }

    this.logger.log(`Admin changed user ${id} verification to ${dto.isVerified}`)

    return { data: this.mapUserRow(result.rows[0] as unknown as UserRow) }
  }

  /**
   * Reset user password (admin only)
   */
  async resetPassword(id: string, dto: ResetPasswordDto) {
    // Hash the new password
    const passwordHash = await bcrypt.hash(dto.newPassword, this.SALT_ROUNDS)

    const query = `
      UPDATE users
      SET password_hash = $1
      WHERE id = $2
      RETURNING id, email, nickname
    `
    const result = await this.db.query(query, [passwordHash, id])

    if (result.rows.length === 0) {
      throw new NotFoundException(`User with ID ${id} not found`)
    }

    const user = result.rows[0] as unknown as { id: string; email: string; nickname: string }

    // Optionally send email notification
    if (dto.sendEmail) {
      try {
        await this.emailService.sendEmail({
          to: user.email,
          subject: 'Your password has been reset',
          text: `Hello ${user.nickname},\n\nYour password has been reset by an administrator.\n\nYour new temporary password is: ${dto.newPassword}\n\nPlease log in and change your password immediately.\n\nBest regards,\nBlich Studio`,
          html: `
            <p>Hello ${user.nickname},</p>
            <p>Your password has been reset by an administrator.</p>
            <p><strong>Your new temporary password is:</strong> ${dto.newPassword}</p>
            <p>Please log in and change your password immediately.</p>
            <p>Best regards,<br/>Blich Studio</p>
          `,
        })
        this.logger.log(`Password reset email sent to user ${id}`)
      } catch (error) {
        this.logger.error(`Failed to send password reset email to user ${id}`, error)
        // Don't throw - password was still reset successfully
      }
    }

    this.logger.log(`Admin reset password for user ${id}`)

    return { message: 'Password reset successfully', emailSent: dto.sendEmail }
  }

  /**
   * Delete a user (admin only)
   */
  async delete(id: string, adminUserId: string) {
    // Prevent admin from deleting themselves
    if (id === adminUserId) {
      throw new ForbiddenException('You cannot delete your own account')
    }

    // Check if user exists
    const checkQuery = `SELECT role FROM users WHERE id = $1`
    const checkResult = await this.db.query(checkQuery, [id])

    if (checkResult.rows.length === 0) {
      throw new NotFoundException(`User with ID ${id} not found`)
    }

    // Prevent deleting other admins
    const userRole = (checkResult.rows[0] as { role: UserRole }).role
    if (userRole === 'admin') {
      throw new ForbiddenException('Cannot delete admin users')
    }

    // Delete user (cascade will handle related data)
    const deleteQuery = `DELETE FROM users WHERE id = $1`
    await this.db.query(deleteQuery, [id])

    this.logger.log(`Admin ${adminUserId} deleted user ${id}`)

    return { message: 'User deleted successfully' }
  }

  /**
   * Map database row to response DTO
   */
  private mapUserRow(row: UserRow) {
    return {
      id: row.id,
      email: row.email,
      nickname: row.nickname,
      firstName: row.first_name,
      lastName: row.last_name,
      role: row.role,
      isVerified: row.is_verified,
      avatarUrl: row.avatar_url,
      createdAt: row.created_at.toISOString(),
      lastLoginAt: row.last_login_at?.toISOString() ?? null,
    }
  }
}
