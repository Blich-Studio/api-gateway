import { MissingEnvironmentVariableError } from '@blich-studio/shared'

const CONTEXT = 'API Gateway'

const requireEnv = (key: string): string => {
  const value = process.env[key]
  if (!value) {
    throw new MissingEnvironmentVariableError(key, CONTEXT)
  }
  return value
}

export default () => {
  const portValue = requireEnv('PORT')
  const port = parseInt(portValue, 10)

  if (Number.isNaN(port)) {
    throw new MissingEnvironmentVariableError('PORT', CONTEXT)
  }

  return {
    port,
    cmsApiUrl: requireEnv('CMS_API_URL'),
    jwtSecret: requireEnv('JWT_SECRET'),
    jwtExpiresIn: requireEnv('JWT_EXPIRES_IN'),
    supabaseUrl: requireEnv('SUPABASE_URL'),
    supabaseServiceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  }
}
