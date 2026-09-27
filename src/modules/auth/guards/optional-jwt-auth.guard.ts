import { Injectable, ExecutionContext } from '@nestjs/common'
import type { Request } from 'express'
import { AuthGuard } from '@nestjs/passport'
import { AuthenticationError } from '../../../common/errors'

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
    context: ExecutionContext
  ): TUser | undefined {
    if (err || !user) {
      // Anonymous reads are allowed, but expired credentials must trigger proxy refresh.
      if (context.switchToHttp().getRequest<Request>().headers.authorization) {
        throw new AuthenticationError('Invalid or expired token')
      }
      return undefined
    }
    return user
  }
}
