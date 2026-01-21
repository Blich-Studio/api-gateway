import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AppConfigService } from './app-config.service'

describe('AppConfigService', () => {
  let service: AppConfigService
  let configService: ConfigService

  const createMockConfigService = (overrides: Record<string, any> = {}) => ({
    get: vi.fn((key: string, defaultValue?: any) => {
      if (key in overrides) {
        return overrides[key]
      }
      return defaultValue
    }),
    getOrThrow: vi.fn((key: string) => {
      if (key in overrides) {
        return overrides[key]
      }
      throw new Error(`Configuration key "${key}" does not exist`)
    }),
  })

  beforeEach(async () => {
    configService = createMockConfigService() as unknown as ConfigService

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppConfigService,
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile()

    service = module.get<AppConfigService>(AppConfigService)
  })

  describe('Environment', () => {
    it('should return default nodeEnv as development', () => {
      expect(service.nodeEnv).toBe('development')
    })

    it('should return configured nodeEnv', async () => {
      const mockConfig = createMockConfigService({ NODE_ENV: 'production' })
      const module = await Test.createTestingModule({
        providers: [
          AppConfigService,
          { provide: ConfigService, useValue: mockConfig },
        ],
      }).compile()
      const svc = module.get<AppConfigService>(AppConfigService)

      expect(svc.nodeEnv).toBe('production')
    })

    it('should return isDevelopment true when NODE_ENV is development', () => {
      expect(service.isDevelopment).toBe(true)
    })

    it('should return isDevelopment false when NODE_ENV is production', async () => {
      const mockConfig = createMockConfigService({ NODE_ENV: 'production' })
      const module = await Test.createTestingModule({
        providers: [
          AppConfigService,
          { provide: ConfigService, useValue: mockConfig },
        ],
      }).compile()
      const svc = module.get<AppConfigService>(AppConfigService)

      expect(svc.isDevelopment).toBe(false)
    })

    it('should return isProduction true when NODE_ENV is production', async () => {
      const mockConfig = createMockConfigService({ NODE_ENV: 'production' })
      const module = await Test.createTestingModule({
        providers: [
          AppConfigService,
          { provide: ConfigService, useValue: mockConfig },
        ],
      }).compile()
      const svc = module.get<AppConfigService>(AppConfigService)

      expect(svc.isProduction).toBe(true)
    })

    it('should return isProduction false when NODE_ENV is development', () => {
      expect(service.isProduction).toBe(false)
    })

    it('should return isTest true when NODE_ENV is test', async () => {
      const mockConfig = createMockConfigService({ NODE_ENV: 'test' })
      const module = await Test.createTestingModule({
        providers: [
          AppConfigService,
          { provide: ConfigService, useValue: mockConfig },
        ],
      }).compile()
      const svc = module.get<AppConfigService>(AppConfigService)

      expect(svc.isTest).toBe(true)
    })

    it('should return default port as 3000', () => {
      expect(service.port).toBe(3000)
    })

    it('should return configured port', async () => {
      const mockConfig = createMockConfigService({ PORT: 8080 })
      const module = await Test.createTestingModule({
        providers: [
          AppConfigService,
          { provide: ConfigService, useValue: mockConfig },
        ],
      }).compile()
      const svc = module.get<AppConfigService>(AppConfigService)

      expect(svc.port).toBe(8080)
    })
  })

  describe('allowedOrigins', () => {
    it('should return development origins by default', () => {
      expect(service.allowedOrigins).toEqual([
        'http://localhost:3000',
        'http://localhost:3001',
      ])
    })

    it('should return production origins when in production', async () => {
      const mockConfig = createMockConfigService({ NODE_ENV: 'production' })
      const module = await Test.createTestingModule({
        providers: [
          AppConfigService,
          { provide: ConfigService, useValue: mockConfig },
        ],
      }).compile()
      const svc = module.get<AppConfigService>(AppConfigService)

      expect(svc.allowedOrigins).toEqual([
        'https://cms.blichstudio.com',
        'https://blichstudio.com',
        'https://www.blichstudio.com',
      ])
    })

    it('should parse custom origins from comma-separated string', async () => {
      const mockConfig = createMockConfigService({
        ALLOWED_ORIGINS: 'https://example.com, https://api.example.com',
      })
      const module = await Test.createTestingModule({
        providers: [
          AppConfigService,
          { provide: ConfigService, useValue: mockConfig },
        ],
      }).compile()
      const svc = module.get<AppConfigService>(AppConfigService)

      expect(svc.allowedOrigins).toEqual([
        'https://example.com',
        'https://api.example.com',
      ])
    })
  })

  describe('Database (PostgreSQL)', () => {
    it('should throw when POSTGRES_HOST is missing', () => {
      expect(() => service.postgresHost).toThrow()
    })

    it('should return configured postgresHost', async () => {
      const mockConfig = createMockConfigService({ POSTGRES_HOST: 'localhost' })
      const module = await Test.createTestingModule({
        providers: [
          AppConfigService,
          { provide: ConfigService, useValue: mockConfig },
        ],
      }).compile()
      const svc = module.get<AppConfigService>(AppConfigService)

      expect(svc.postgresHost).toBe('localhost')
    })

    it('should throw when POSTGRES_PORT is missing', () => {
      expect(() => service.postgresPort).toThrow()
    })

    it('should throw when POSTGRES_USER is missing', () => {
      expect(() => service.postgresUser).toThrow()
    })

    it('should throw when POSTGRES_PASSWORD is missing', () => {
      expect(() => service.postgresPassword).toThrow()
    })

    it('should throw when POSTGRES_DB is missing', () => {
      expect(() => service.postgresDatabase).toThrow()
    })

    it('should return default postgresPoolMax as 20', () => {
      expect(service.postgresPoolMax).toBe(20)
    })

    it('should return default postgresIdleTimeout as 30000', () => {
      expect(service.postgresIdleTimeout).toBe(30000)
    })

    it('should return default postgresConnectionTimeout as 2000', () => {
      expect(service.postgresConnectionTimeout).toBe(2000)
    })

    it('should return postgresSslEnabled false by default', () => {
      expect(service.postgresSslEnabled).toBe(false)
    })

    it('should return postgresSslEnabled true when POSTGRES_SSL is "true"', async () => {
      const mockConfig = createMockConfigService({ POSTGRES_SSL: 'true' })
      const module = await Test.createTestingModule({
        providers: [
          AppConfigService,
          { provide: ConfigService, useValue: mockConfig },
        ],
      }).compile()
      const svc = module.get<AppConfigService>(AppConfigService)

      expect(svc.postgresSslEnabled).toBe(true)
    })

    it('should return postgresSslEnabled true when POSTGRES_SSL is "1"', async () => {
      const mockConfig = createMockConfigService({ POSTGRES_SSL: '1' })
      const module = await Test.createTestingModule({
        providers: [
          AppConfigService,
          { provide: ConfigService, useValue: mockConfig },
        ],
      }).compile()
      const svc = module.get<AppConfigService>(AppConfigService)

      expect(svc.postgresSslEnabled).toBe(true)
    })

    it('should return postgresSslRejectUnauthorized true by default', () => {
      expect(service.postgresSslRejectUnauthorized).toBe(true)
    })

    it('should return postgresSslRejectUnauthorized false when set to "false"', async () => {
      const mockConfig = createMockConfigService({
        POSTGRES_SSL_REJECT_UNAUTHORIZED: 'false',
      })
      const module = await Test.createTestingModule({
        providers: [
          AppConfigService,
          { provide: ConfigService, useValue: mockConfig },
        ],
      }).compile()
      const svc = module.get<AppConfigService>(AppConfigService)

      expect(svc.postgresSslRejectUnauthorized).toBe(false)
    })

    it('should return postgresSslRejectUnauthorized false when set to "0"', async () => {
      const mockConfig = createMockConfigService({
        POSTGRES_SSL_REJECT_UNAUTHORIZED: '0',
      })
      const module = await Test.createTestingModule({
        providers: [
          AppConfigService,
          { provide: ConfigService, useValue: mockConfig },
        ],
      }).compile()
      const svc = module.get<AppConfigService>(AppConfigService)

      expect(svc.postgresSslRejectUnauthorized).toBe(false)
    })

    it('should return undefined for postgresSslCa by default', () => {
      expect(service.postgresSslCa).toBeUndefined()
    })

    it('should return configured postgresSslCa', async () => {
      const mockConfig = createMockConfigService({
        POSTGRES_SSL_CA: '/path/to/ca.crt',
      })
      const module = await Test.createTestingModule({
        providers: [
          AppConfigService,
          { provide: ConfigService, useValue: mockConfig },
        ],
      }).compile()
      const svc = module.get<AppConfigService>(AppConfigService)

      expect(svc.postgresSslCa).toBe('/path/to/ca.crt')
    })
  })

  describe('JWT / JWKS Authentication', () => {
    it('should return undefined for jwksUrl by default', () => {
      expect(service.jwksUrl).toBeUndefined()
    })

    it('should return configured jwksUrl', async () => {
      const mockConfig = createMockConfigService({
        JWKS_URL: 'https://auth.example.com/.well-known/jwks.json',
      })
      const module = await Test.createTestingModule({
        providers: [
          AppConfigService,
          { provide: ConfigService, useValue: mockConfig },
        ],
      }).compile()
      const svc = module.get<AppConfigService>(AppConfigService)

      expect(svc.jwksUrl).toBe('https://auth.example.com/.well-known/jwks.json')
    })

    it('should return undefined for jwksTokenEndpoint by default', () => {
      expect(service.jwksTokenEndpoint).toBeUndefined()
    })

    it('should return undefined for jwksTokenApiKey by default', () => {
      expect(service.jwksTokenApiKey).toBeUndefined()
    })

    it('should return undefined for jwtIssuer by default', () => {
      expect(service.jwtIssuer).toBeUndefined()
    })

    it('should return undefined for jwtAudience by default', () => {
      expect(service.jwtAudience).toBeUndefined()
    })
  })

  describe('Google Cloud Storage (GCS)', () => {
    it('should return undefined for gcpProjectId by default', () => {
      expect(service.gcpProjectId).toBeUndefined()
    })

    it('should return default gcsBucketName', () => {
      expect(service.gcsBucketName).toBe('blich-studio-uploads')
    })

    it('should return default gcsBucketLocation', () => {
      expect(service.gcsBucketLocation).toBe('US')
    })

    it('should return default gcsPublicUrl using bucket name', () => {
      expect(service.gcsPublicUrl).toBe(
        'https://storage.googleapis.com/blich-studio-uploads'
      )
    })

    it('should return configured gcsPublicUrl', async () => {
      const mockConfig = createMockConfigService({
        GCS_PUBLIC_URL: 'https://cdn.example.com',
      })
      const module = await Test.createTestingModule({
        providers: [
          AppConfigService,
          { provide: ConfigService, useValue: mockConfig },
        ],
      }).compile()
      const svc = module.get<AppConfigService>(AppConfigService)

      expect(svc.gcsPublicUrl).toBe('https://cdn.example.com')
    })

    it('should return undefined for gcsApiEndpoint by default', () => {
      expect(service.gcsApiEndpoint).toBeUndefined()
    })

    it('should return GCS_API_ENDPOINT when configured', async () => {
      const mockConfig = createMockConfigService({
        GCS_API_ENDPOINT: 'http://localhost:4443',
      })
      const module = await Test.createTestingModule({
        providers: [
          AppConfigService,
          { provide: ConfigService, useValue: mockConfig },
        ],
      }).compile()
      const svc = module.get<AppConfigService>(AppConfigService)

      expect(svc.gcsApiEndpoint).toBe('http://localhost:4443')
    })

    it('should fallback to GCS_EMULATOR_HOST when GCS_API_ENDPOINT is not set', async () => {
      const mockConfig = createMockConfigService({
        GCS_EMULATOR_HOST: 'http://localhost:9000',
      })
      const module = await Test.createTestingModule({
        providers: [
          AppConfigService,
          { provide: ConfigService, useValue: mockConfig },
        ],
      }).compile()
      const svc = module.get<AppConfigService>(AppConfigService)

      expect(svc.gcsApiEndpoint).toBe('http://localhost:9000')
    })

    it('should return undefined for googleApplicationCredentials by default', () => {
      expect(service.googleApplicationCredentials).toBeUndefined()
    })
  })

  describe('Email (SendGrid)', () => {
    it('should return undefined for sendgridApiKey by default', () => {
      expect(service.sendgridApiKey).toBeUndefined()
    })

    it('should return undefined for emailFrom by default', () => {
      expect(service.emailFrom).toBeUndefined()
    })

    it('should return default appUrl', () => {
      expect(service.appUrl).toBe('http://localhost:3000')
    })

    it('should return default companyName', () => {
      expect(service.companyName).toBe('Blich Studio')
    })
  })

  describe('Security', () => {
    it('should return default bcryptSaltRounds as 12', () => {
      expect(service.bcryptSaltRounds).toBe(12)
    })

    it('should return configured bcryptSaltRounds', async () => {
      const mockConfig = createMockConfigService({ BCRYPT_SALT_ROUNDS: '10' })
      const module = await Test.createTestingModule({
        providers: [
          AppConfigService,
          { provide: ConfigService, useValue: mockConfig },
        ],
      }).compile()
      const svc = module.get<AppConfigService>(AppConfigService)

      expect(svc.bcryptSaltRounds).toBe(10)
    })

    it('should return default verificationTokenExpiryHours as 24', () => {
      expect(service.verificationTokenExpiryHours).toBe(24)
    })
  })

  describe('Dev toggles', () => {
    it('should return devUseDevJwt false by default', () => {
      expect(service.devUseDevJwt).toBe(false)
    })

    it('should return devUseDevJwt true when set to "true"', async () => {
      const mockConfig = createMockConfigService({ DEV_USE_DEV_JWT: 'true' })
      const module = await Test.createTestingModule({
        providers: [
          AppConfigService,
          { provide: ConfigService, useValue: mockConfig },
        ],
      }).compile()
      const svc = module.get<AppConfigService>(AppConfigService)

      expect(svc.devUseDevJwt).toBe(true)
    })

    it('should return devAcceptDummyJwt false by default', () => {
      expect(service.devAcceptDummyJwt).toBe(false)
    })

    it('should return devAcceptDummyJwt true when set to "true"', async () => {
      const mockConfig = createMockConfigService({ DEV_ACCEPT_DUMMY_JWT: 'true' })
      const module = await Test.createTestingModule({
        providers: [
          AppConfigService,
          { provide: ConfigService, useValue: mockConfig },
        ],
      }).compile()
      const svc = module.get<AppConfigService>(AppConfigService)

      expect(svc.devAcceptDummyJwt).toBe(true)
    })

    it('should return devUseRealGcs false by default', () => {
      expect(service.devUseRealGcs).toBe(false)
    })

    it('should return devUseRealGcs true when set to "true"', async () => {
      const mockConfig = createMockConfigService({ DEV_USE_REAL_GCS: 'true' })
      const module = await Test.createTestingModule({
        providers: [
          AppConfigService,
          { provide: ConfigService, useValue: mockConfig },
        ],
      }).compile()
      const svc = module.get<AppConfigService>(AppConfigService)

      expect(svc.devUseRealGcs).toBe(true)
    })

    it('should return devVerboseAuthLogs false by default', () => {
      expect(service.devVerboseAuthLogs).toBe(false)
    })

    it('should return devVerboseAuthLogs true when set to "true"', async () => {
      const mockConfig = createMockConfigService({ DEV_VERBOSE_AUTH_LOGS: 'true' })
      const module = await Test.createTestingModule({
        providers: [
          AppConfigService,
          { provide: ConfigService, useValue: mockConfig },
        ],
      }).compile()
      const svc = module.get<AppConfigService>(AppConfigService)

      expect(svc.devVerboseAuthLogs).toBe(true)
    })
  })
})
