export interface User {
  id: string
  email: string
  nickname: string
  firstName: string | null
  lastName: string | null
  isVerified: boolean
  role: 'user' | 'writer' | 'admin'
  createdAt: Date
}

export interface UserWithPassword extends User {
  passwordHash: string
}

export interface VerificationToken {
  token: string
  userId: string
  email: string
  expiresAt: Date
}

export type RegisterResponse = User

export interface VerifyEmailResponse {
  message: string
}

export interface ResendVerificationResponse {
  message: string
}
