import { HttpException, HttpStatus } from '@nestjs/common'

/**
 * Base application error class that extends HttpException
 * Provides consistent error structure across the application
 */
export class AppError extends HttpException {
  public code: string

  constructor(
    code: string,
    message: string,
    statusCode: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
    public readonly details?: Record<string, unknown>
  ) {
    super(
      {
        code,
        message,
        statusCode,
        ...(details && { details }),
      },
      statusCode
    )
    this.code = code
  }
}

/**
 * Authentication and Authorization Errors
 */
export class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed', details?: Record<string, unknown>) {
    super('AUTHENTICATION_ERROR', message, HttpStatus.UNAUTHORIZED, details)
  }
}

export class InvalidCredentialsError extends AuthenticationError {
  constructor(message = 'Invalid credentials') {
    super(message)
    this.code = 'INVALID_CREDENTIALS'
  }
}

export class EmailNotVerifiedError extends AuthenticationError {
  constructor(message = 'Please verify your email before logging in') {
    super(message)
    this.code = 'EMAIL_NOT_VERIFIED'
  }
}

export class AuthServiceUnavailableError extends AuthenticationError {
  constructor(message = 'Authentication service temporarily unavailable') {
    super(message)
    this.code = 'AUTH_SERVICE_UNAVAILABLE'
  }
}

export class InvalidAuthResponseError extends AuthenticationError {
  constructor(message = 'Invalid response from authentication service') {
    super(message)
    this.code = 'INVALID_AUTH_RESPONSE'
  }
}

export class TokenGenerationError extends AuthenticationError {
  constructor(message = 'Unable to generate authentication token') {
    super(message)
    this.code = 'TOKEN_GENERATION_ERROR'
  }
}

/**
 * User Registration Errors
 */
export class RegistrationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('REGISTRATION_ERROR', message, HttpStatus.BAD_REQUEST, details)
  }
}

export class EmailAlreadyInUseError extends AppError {
  constructor(message = 'A user with this email already exists') {
    super('EMAIL_ALREADY_IN_USE', message, HttpStatus.CONFLICT)
  }
}

/**
 * Email Verification Errors
 */
export class VerificationError extends AppError {
  constructor(message: string, code = 'VERIFICATION_ERROR') {
    super(code, message, HttpStatus.BAD_REQUEST)
  }
}

export class InvalidVerificationTokenError extends VerificationError {
  constructor(message = 'The verification token is invalid') {
    super(message, 'INVALID_VERIFICATION_TOKEN')
  }
}

export class VerificationTokenExpiredError extends VerificationError {
  constructor(message = 'The verification token has expired') {
    super(message, 'VERIFICATION_TOKEN_EXPIRED')
  }
}

/**
 * Database Errors
 */
export class DatabaseError extends AppError {
  constructor(message = 'Database operation failed', details?: Record<string, unknown>) {
    super('DATABASE_ERROR', message, HttpStatus.INTERNAL_SERVER_ERROR, details)
  }
}

export class DatabaseConnectionError extends DatabaseError {
  constructor(message = 'Failed to connect to database') {
    super(message)
    this.code = 'DATABASE_CONNECTION_ERROR'
  }
}

/**
 * Validation Errors
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION_ERROR', message, HttpStatus.BAD_REQUEST, details)
  }
}

/**
 * Configuration Errors
 */
export class ConfigurationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('CONFIGURATION_ERROR', message, HttpStatus.INTERNAL_SERVER_ERROR, details)
  }
}

export class MissingConfigurationError extends ConfigurationError {
  constructor(configKey: string) {
    super(`Missing required configuration: ${configKey}`, { configKey })
    this.code = 'MISSING_CONFIGURATION'
  }
}

/**
 * Not Found Errors
 */
export class NotFoundError extends AppError {
  constructor(resource: string, message?: string) {
    super('NOT_FOUND', message ?? `${resource} not found`, HttpStatus.NOT_FOUND, { resource })
  }
}

export class UserNotFoundError extends NotFoundError {
  constructor(identifier?: string) {
    super('User', identifier ? `User not found: ${identifier}` : 'User not found')
    this.code = 'USER_NOT_FOUND'
  }
}

/**
 * Rate Limiting Errors
 */
export class RateLimitError extends AppError {
  constructor(message = 'Too many requests, please try again later') {
    super('RATE_LIMIT_EXCEEDED', message, HttpStatus.TOO_MANY_REQUESTS)
  }
}

/**
 * Service Errors
 */
export class ServiceError extends AppError {
  constructor(serviceName: string, message = 'Service error', details?: Record<string, unknown>) {
    super('SERVICE_ERROR', message, HttpStatus.INTERNAL_SERVER_ERROR, {
      service: serviceName,
      ...details,
    })
  }
}

export class ExternalServiceError extends ServiceError {
  constructor(serviceName: string, message: string, details?: Record<string, unknown>) {
    super(serviceName, message, details)
    this.code = 'EXTERNAL_SERVICE_ERROR'
  }
}
