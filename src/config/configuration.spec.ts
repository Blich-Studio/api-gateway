import { MissingEnvironmentVariableError } from '@blich-studio/shared'
import configuration from './configuration'

type RequiredEnvKeys =
  | 'PORT'
  | 'CMS_API_URL'
  | 'JWT_SECRET'
  | 'JWT_EXPIRES_IN'
  | 'SUPABASE_URL'
  | 'SUPABASE_SERVICE_ROLE_KEY'

const REQUIRED_ENV: Record<RequiredEnvKeys, string> = {
  PORT: '3000',
  CMS_API_URL: 'http://cms.local',
  JWT_SECRET: 'super-secret',
  JWT_EXPIRES_IN: '60m',
  SUPABASE_URL: 'https://supabase.local',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
}

describe('configuration env validation', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv, ...REQUIRED_ENV }
    jest.resetModules()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  const callConfig = () => configuration()
  const expectMissingEnvFailure = (missingKey: RequiredEnvKeys) => {
    try {
      callConfig()
    } catch (error: unknown) {
      if (error instanceof MissingEnvironmentVariableError) {
        expect(error.variableName).toBe(missingKey)
        expect(error.message).toContain(missingKey)
        return
      }

      throw error
    }

    throw new Error('Expected MissingEnvironmentVariableError to be thrown')
  }

  it.each(Object.keys(REQUIRED_ENV) as RequiredEnvKeys[])(
    'throws MissingEnvironmentVariableError when %s is absent',
    key => {
      delete process.env[key]
      expectMissingEnvFailure(key)
    }
  )

  it('returns config when all required variables exist', () => {
    const config = callConfig() as {
      port: number
      cmsApiUrl: string
      jwtSecret: string
      jwtExpiresIn: string
      supabaseUrl?: string
      supabaseServiceRoleKey?: string
    }
    expect(config.port).toBe(Number(REQUIRED_ENV.PORT))
    expect(config.cmsApiUrl).toBe(REQUIRED_ENV.CMS_API_URL)
    expect(config.jwtSecret).toBe(REQUIRED_ENV.JWT_SECRET)
    expect(config.jwtExpiresIn).toBe(REQUIRED_ENV.JWT_EXPIRES_IN)
    expect(config.supabaseUrl).toBe(REQUIRED_ENV.SUPABASE_URL)
    expect(config.supabaseServiceRoleKey).toBe(REQUIRED_ENV.SUPABASE_SERVICE_ROLE_KEY)
  })
})
