export interface User {
  id: string
  email: string
  name: string
  isVerified: boolean
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
