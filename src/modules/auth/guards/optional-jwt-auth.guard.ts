import { Injectable, ExecutionContext } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'

/**
 * Optional JWT Auth Guard
 * Attempts to authenticate but doesn't fail if no token provided
 * Useful for endpoints that have different behavior for authenticated vs anonymous users
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = unknown>(
    err: Error | null,
    user: TUser | false,
    _info: unknown,
    _context: ExecutionContext
  ): TUser | undefined {
    // Don't throw error, just return undefined if not authenticated
    if (err || !user) {
      return undefined
    }
    return user
  }
}
