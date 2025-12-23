import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ROLES_KEY, type UserRole } from '../decorators/roles.decorator'
import { POSTGRES_CLIENT, type PostgresClient } from '../../database/postgres.module'

interface AuthUser {
  userId: string
  email: string
}

/**
 * Guard that checks if the authenticated user has the required role.
 * Must be used after JwtAuthGuard to ensure user is authenticated.
 *
 * Role hierarchy:
 * - reader: Can read content, create/edit own comments, like/unlike
 * - writer: All reader permissions + create/edit/publish articles and projects
 * - admin: Full access to everything
 *
 * @example
 * @Roles('writer', 'admin')
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * async createArticle() { ... }
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @Inject(POSTGRES_CLIENT) private readonly db: PostgresClient
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    // If no roles specified, allow access (public or just requires auth)
    if (!requiredRoles || requiredRoles.length === 0) {
      return true
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const request = context.switchToHttp().getRequest()
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const user = request.user as AuthUser | undefined

    if (!user) {
      throw new ForbiddenException('Authentication required')
    }

    // Fetch user role from database
    const result = await this.db.query('SELECT role FROM users WHERE id = $1', [user.userId])

    if (result.rows.length === 0) {
      throw new ForbiddenException('User not found')
    }

    const userRole = result.rows[0].role as UserRole

    // Admin has access to everything
    if (userRole === 'admin') {
      return true
    }

    // Writer has access to writer and reader endpoints
    if (
      userRole === 'writer' &&
      (requiredRoles.includes('writer') || requiredRoles.includes('reader'))
    ) {
      return true
    }

    // Reader has access only to reader endpoints
    if (userRole === 'reader' && requiredRoles.includes('reader')) {
      return true
    }

    throw new ForbiddenException(`Access denied. Required roles: ${requiredRoles.join(', ')}`)
  }
}
