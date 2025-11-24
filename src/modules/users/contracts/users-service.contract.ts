import type { UserRole } from '../../auth/auth.types'
import type { CreateUserDto } from '../dto/create-user.dto'
import type { CmsUser } from '../interfaces/cms-user.interface'

export interface UsersServiceContract {
  createUser(payload: CreateUserDto): Promise<CmsUser>
  findByExternalId(externalId: string): Promise<CmsUser>
  getRoleForUser(externalId: string): Promise<UserRole>
  isOwner(userId: string, ownerId: string): boolean
  hasRole(userRole: UserRole, allowed: UserRole | UserRole[]): boolean
}

export const USERS_SERVICE = Symbol('USERS_SERVICE')
