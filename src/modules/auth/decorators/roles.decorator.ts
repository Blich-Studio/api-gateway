import { SetMetadata } from '@nestjs/common'

export type UserRole = 'reader' | 'writer' | 'admin'

export const ROLES_KEY = 'roles'

/**
 * Decorator to specify which roles can access an endpoint.
 * Use with RolesGuard.
 *
 * @example
 * @Roles('writer', 'admin')
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * async createArticle() { ... }
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles)
