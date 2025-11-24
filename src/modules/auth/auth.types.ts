export type UserRole = 'admin' | 'writer' | 'reader'

export interface AuthenticatedUser {
  userId: string
  role: UserRole
  email?: string
}
