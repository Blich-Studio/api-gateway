import { HttpStatus } from '@nestjs/common'
import { describe, it, expect } from 'vitest'
import {
  AppError,
  AuthenticationError,
  InvalidCredentialsError,
  EmailNotVerifiedError,
  AuthServiceUnavailableError,
  InvalidAuthResponseError,
  TokenGenerationError,
  RegistrationError,
  EmailAlreadyInUseError,
  VerificationError,
  InvalidVerificationTokenError,
  VerificationTokenExpiredError,
  DatabaseError,
  DatabaseConnectionError,
  ValidationError,
  ConfigurationError,
  MissingConfigurationError,
  NotFoundError,
  UserNotFoundError,
  RateLimitError,
  ServiceError,
  ExternalServiceError,
} from './app.error'

describe('AppError', () => {
  it('should create error with correct properties', () => {
    const error = new AppError('TEST_CODE', 'Test message', HttpStatus.BAD_REQUEST, {
      detail: 'value',
    })

    expect(error.code).toBe('TEST_CODE')
    expect(error.message).toBeDefined()
    expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST)
    expect(error.details).toEqual({ detail: 'value' })
  })

  it('should default to INTERNAL_SERVER_ERROR status', () => {
    const error = new AppError('TEST_CODE', 'Test message')

    expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR)
  })
})

describe('AuthenticationError', () => {
  it('should have correct code and status', () => {
    const error = new AuthenticationError()

    expect(error.code).toBe('AUTHENTICATION_ERROR')
    expect(error.getStatus()).toBe(HttpStatus.UNAUTHORIZED)
    expect(error.message).toBeDefined()
  })

  it('should accept custom message', () => {
    const error = new AuthenticationError('Custom auth error')

    expect(error.code).toBe('AUTHENTICATION_ERROR')
    expect(error.message).toContain('Custom auth error')
  })
})

describe('InvalidCredentialsError', () => {
  it('should have correct code and inherit from AuthenticationError', () => {
    const error = new InvalidCredentialsError()

    expect(error.code).toBe('INVALID_CREDENTIALS')
    expect(error.getStatus()).toBe(HttpStatus.UNAUTHORIZED)
    expect(error).toBeInstanceOf(AuthenticationError)
  })

  it('should accept custom message', () => {
    const error = new InvalidCredentialsError('Wrong password')

    expect(error.code).toBe('INVALID_CREDENTIALS')
    expect(error.message).toContain('Wrong password')
  })
})

describe('EmailNotVerifiedError', () => {
  it('should have correct code and status', () => {
    const error = new EmailNotVerifiedError()

    expect(error.code).toBe('EMAIL_NOT_VERIFIED')
    expect(error.getStatus()).toBe(HttpStatus.UNAUTHORIZED)
    expect(error).toBeInstanceOf(AuthenticationError)
  })
})

describe('AuthServiceUnavailableError', () => {
  it('should have correct code and status', () => {
    const error = new AuthServiceUnavailableError()

    expect(error.code).toBe('AUTH_SERVICE_UNAVAILABLE')
    expect(error.getStatus()).toBe(HttpStatus.UNAUTHORIZED)
  })
})

describe('InvalidAuthResponseError', () => {
  it('should have correct code and status', () => {
    const error = new InvalidAuthResponseError()

    expect(error.code).toBe('INVALID_AUTH_RESPONSE')
    expect(error.getStatus()).toBe(HttpStatus.UNAUTHORIZED)
  })
})

describe('TokenGenerationError', () => {
  it('should have correct code and status', () => {
    const error = new TokenGenerationError()

    expect(error.code).toBe('TOKEN_GENERATION_ERROR')
    expect(error.getStatus()).toBe(HttpStatus.UNAUTHORIZED)
  })
})

describe('RegistrationError', () => {
  it('should have correct code and status', () => {
    const error = new RegistrationError('Registration failed')

    expect(error.code).toBe('REGISTRATION_ERROR')
    expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST)
  })

  it('should include details', () => {
    const error = new RegistrationError('Registration failed', { field: 'email' })

    expect(error.details).toEqual({ field: 'email' })
  })
})

describe('EmailAlreadyInUseError', () => {
  it('should have correct code and status', () => {
    const error = new EmailAlreadyInUseError()

    expect(error.code).toBe('EMAIL_ALREADY_IN_USE')
    expect(error.getStatus()).toBe(HttpStatus.CONFLICT)
  })
})

describe('VerificationError', () => {
  it('should have correct code and status', () => {
    const error = new VerificationError('Verification failed')

    expect(error.code).toBe('VERIFICATION_ERROR')
    expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST)
  })

  it('should accept custom code', () => {
    const error = new VerificationError('Failed', 'CUSTOM_VERIFICATION_CODE')

    expect(error.code).toBe('CUSTOM_VERIFICATION_CODE')
  })
})

describe('InvalidVerificationTokenError', () => {
  it('should have correct code and status', () => {
    const error = new InvalidVerificationTokenError()

    expect(error.code).toBe('INVALID_VERIFICATION_TOKEN')
    expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST)
    expect(error).toBeInstanceOf(VerificationError)
  })
})

describe('VerificationTokenExpiredError', () => {
  it('should have correct code and status', () => {
    const error = new VerificationTokenExpiredError()

    expect(error.code).toBe('VERIFICATION_TOKEN_EXPIRED')
    expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST)
    expect(error).toBeInstanceOf(VerificationError)
  })
})

describe('DatabaseError', () => {
  it('should have correct code and status', () => {
    const error = new DatabaseError()

    expect(error.code).toBe('DATABASE_ERROR')
    expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR)
  })

  it('should include details', () => {
    const error = new DatabaseError('Connection failed', { host: 'localhost' })

    expect(error.details).toEqual({ host: 'localhost' })
  })
})

describe('DatabaseConnectionError', () => {
  it('should have correct code and inherit from DatabaseError', () => {
    const error = new DatabaseConnectionError()

    expect(error.code).toBe('DATABASE_CONNECTION_ERROR')
    expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR)
    expect(error).toBeInstanceOf(DatabaseError)
  })
})

describe('ValidationError', () => {
  it('should have correct code and status', () => {
    const error = new ValidationError('Invalid input')

    expect(error.code).toBe('VALIDATION_ERROR')
    expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST)
  })

  it('should include validation details', () => {
    const error = new ValidationError('Invalid input', { field: 'email', rule: 'format' })

    expect(error.details).toEqual({ field: 'email', rule: 'format' })
  })
})

describe('ConfigurationError', () => {
  it('should have correct code and status', () => {
    const error = new ConfigurationError('Config missing')

    expect(error.code).toBe('CONFIGURATION_ERROR')
    expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR)
  })
})

describe('MissingConfigurationError', () => {
  it('should have correct code and include config key', () => {
    const error = new MissingConfigurationError('JWT_SECRET')

    expect(error.code).toBe('MISSING_CONFIGURATION')
    expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR)
    expect(error.details).toEqual({ configKey: 'JWT_SECRET' })
    expect(error).toBeInstanceOf(ConfigurationError)
  })
})

describe('NotFoundError', () => {
  it('should have correct code and status', () => {
    const error = new NotFoundError('Resource')

    expect(error.code).toBe('NOT_FOUND')
    expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND)
    expect(error.details).toEqual({ resource: 'Resource' })
  })

  it('should accept custom message', () => {
    const error = new NotFoundError('User', 'User with ID 123 not found')

    expect(error.code).toBe('NOT_FOUND')
    expect(error.message).toContain('User with ID 123 not found')
  })
})

describe('UserNotFoundError', () => {
  it('should have correct code and inherit from NotFoundError', () => {
    const error = new UserNotFoundError()

    expect(error.code).toBe('USER_NOT_FOUND')
    expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND)
    expect(error).toBeInstanceOf(NotFoundError)
  })

  it('should include identifier in message', () => {
    const error = new UserNotFoundError('user@example.com')

    expect(error.code).toBe('USER_NOT_FOUND')
    expect(error.message).toContain('user@example.com')
  })
})

describe('RateLimitError', () => {
  it('should have correct code and status', () => {
    const error = new RateLimitError()

    expect(error.code).toBe('RATE_LIMIT_EXCEEDED')
    expect(error.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS)
  })
})

describe('ServiceError', () => {
  it('should have correct code and status', () => {
    const error = new ServiceError('EmailService', 'Service unavailable')

    expect(error.code).toBe('SERVICE_ERROR')
    expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR)
    expect(error.details).toMatchObject({ service: 'EmailService' })
  })

  it('should include additional details', () => {
    const error = new ServiceError('EmailService', 'Service error', { retry: 3 })

    expect(error.details).toMatchObject({ service: 'EmailService', retry: 3 })
  })
})

describe('ExternalServiceError', () => {
  it('should have correct code and inherit from ServiceError', () => {
    const error = new ExternalServiceError('PaymentAPI', 'API timeout')

    expect(error.code).toBe('EXTERNAL_SERVICE_ERROR')
    expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR)
    expect(error).toBeInstanceOf(ServiceError)
    expect(error.details).toMatchObject({ service: 'PaymentAPI' })
  })
})
