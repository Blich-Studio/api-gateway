import type { UserRole } from '../../auth/auth.types'

export interface CmsUser {
  id: string
  externalId?: string
  email?: string
  role: UserRole
  displayName?: string
}
