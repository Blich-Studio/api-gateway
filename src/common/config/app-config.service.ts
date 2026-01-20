import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

/**
 * Centralized configuration service for all environment variables.
 * All env var access should go through this service to ensure:
 * - Type safety
 * - Default values
 * - Validation
 * - Single source of truth
 */
@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService) {}

  // ============================================
  // Environment
  // ============================================

  get nodeEnv(): string {
    return this.configService.get<string>('NODE_ENV', 'development')
  }

  get isDevelopment(): boolean {
    return this.nodeEnv === 'development'
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production'
  }

  get isTest(): boolean {
    return this.nodeEnv === 'test'
  }

  get port(): number {
    return this.configService.get<number>('PORT', 3000)
  }

  get allowedOrigins(): string[] {
    const origins = this.configService.get<string>('ALLOWED_ORIGINS')
    if (origins) {
      return origins.split(',').map(o => o.trim())
    }
    return this.isProduction
      ? ['https://cms.blichstudio.com', 'https://blichstudio.com', 'https://www.blichstudio.com']
      : ['http://localhost:3000', 'http://localhost:3001']
  }

  // ============================================
  // Database (PostgreSQL)
  // ============================================

  get postgresHost(): string {
    return this.configService.getOrThrow<string>('POSTGRES_HOST')
  }

  get postgresPort(): number {
    return this.configService.getOrThrow<number>('POSTGRES_PORT')
  }

  get postgresUser(): string {
    return this.configService.getOrThrow<string>('POSTGRES_USER')
  }

  get postgresPassword(): string {
    return this.configService.getOrThrow<string>('POSTGRES_PASSWORD')
  }

  get postgresDatabase(): string {
    return this.configService.getOrThrow<string>('POSTGRES_DB')
  }

  get postgresPoolMax(): number {
    return this.configService.get<number>('POSTGRES_POOL_MAX', 20)
  }

  get postgresIdleTimeout(): number {
    return this.configService.get<number>('POSTGRES_IDLE_TIMEOUT', 30000)
  }

  get postgresConnectionTimeout(): number {
    return this.configService.get<number>('POSTGRES_CONNECTION_TIMEOUT', 2000)
  }

  get postgresSslEnabled(): boolean {
    const ssl = this.configService.get<string>('POSTGRES_SSL', 'false')
    return ssl === 'true' || ssl === '1'
  }

  get postgresSslRejectUnauthorized(): boolean {
    const value = this.configService.get<string>('POSTGRES_SSL_REJECT_UNAUTHORIZED')
    return value !== 'false' && value !== '0'
  }

  get postgresSslCa(): string | undefined {
    return this.configService.get<string>('POSTGRES_SSL_CA')
  }

  // ============================================
  // JWT / JWKS Authentication
  // ============================================

  get jwksUrl(): string | undefined {
    return this.configService.get<string>('JWKS_URL')
  }

  get jwksTokenEndpoint(): string | undefined {
    return this.configService.get<string>('JWKS_TOKEN_ENDPOINT')
  }

  get jwksTokenApiKey(): string | undefined {
    return this.configService.get<string>('JWKS_TOKEN_API_KEY')
  }

  get jwtIssuer(): string | undefined {
    return this.configService.get<string>('JWT_ISSUER')
  }

  get jwtAudience(): string | undefined {
    return this.configService.get<string>('JWT_AUDIENCE')
  }

  // ============================================
  // Google Cloud Storage (GCS)
  // ============================================

  get gcpProjectId(): string | undefined {
    return this.configService.get<string>('GCP_PROJECT_ID')
  }

  get gcsBucketName(): string {
    return this.configService.get<string>('GCS_BUCKET_NAME', 'blich-studio-uploads')
  }

  get gcsBucketLocation(): string {
    return this.configService.get<string>('GCS_BUCKET_LOCATION', 'US')
  }

  get gcsPublicUrl(): string {
    const configuredUrl = this.configService.get<string>('GCS_PUBLIC_URL')
    return configuredUrl ?? `https://storage.googleapis.com/${this.gcsBucketName}`
  }

  get gcsApiEndpoint(): string | undefined {
    return (
      this.configService.get<string>('GCS_API_ENDPOINT') ??
      this.configService.get<string>('GCS_EMULATOR_HOST') ??
      undefined
    )
  }

  get googleApplicationCredentials(): string | undefined {
    return this.configService.get<string>('GOOGLE_APPLICATION_CREDENTIALS')
  }

  // ============================================
  // Email (SendGrid)
  // ============================================

  get sendgridApiKey(): string | undefined {
    return this.configService.get<string>('SENDGRID_API_KEY')
  }

  get emailFrom(): string | undefined {
    return this.configService.get<string>('EMAIL_FROM')
  }

  get appUrl(): string {
    return this.configService.get<string>('APP_URL', 'http://localhost:3000')
  }

  get companyName(): string {
    return this.configService.get<string>('COMPANY_NAME', 'Blich Studio')
  }

  // ============================================
  // Security
  // ============================================

  get bcryptSaltRounds(): number {
    return parseInt(this.configService.get<string>('BCRYPT_SALT_ROUNDS', '12'), 10)
  }

  get verificationTokenExpiryHours(): number {
    return this.configService.get<number>('VERIFICATION_TOKEN_EXPIRY_HOURS', 24)
  }

  // ============================================
  // Dev toggles
  // ============================================

  get devUseDevJwt(): boolean {
    return this.configService.get<string>('DEV_USE_DEV_JWT', 'false') === 'true'
  }

  get devAcceptDummyJwt(): boolean {
    return this.configService.get<string>('DEV_ACCEPT_DUMMY_JWT', 'false') === 'true'
  }

  get devUseRealGcs(): boolean {
    return this.configService.get<string>('DEV_USE_REAL_GCS', 'false') === 'true'
  }

  get devVerboseAuthLogs(): boolean {
    return this.configService.get<string>('DEV_VERBOSE_AUTH_LOGS', 'false') === 'true'
  }
}
