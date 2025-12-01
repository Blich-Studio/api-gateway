# Blich Studio API Gateway

The API Gateway for Blich Studio, built with [NestJS](https://nestjs.com/). This service acts as the entry point for client applications, aggregating data from various microservices (like the CMS API) and providing a unified GraphQL and REST interface.

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running the Application](#running-the-application)
- [Docker Development](#docker-development)
- [Docker Production](#docker-production)
- [GCP Cloud Deployment](#gcp-cloud-deployment)
- [Testing](#testing)
- [Environment Variables](#environment-variables)
- [User Registration & Email Verification](#user-registration--email-verification)
- [Authentication Workflows](#authentication-workflows)
- [REST Endpoints](#rest-endpoints)
- [Architecture](#architecture)
- [Database Setup](#database-setup)
- [Deployment](#deployment)
- [Monitoring and Troubleshooting](#monitoring-and-troubleshooting)

## Features

- **GraphQL Interface**: Aggregates data from backend services (e.g., CMS API) into a single GraphQL schema
- **Authentication**: JWT-based authentication with email verification system
- **Security**: Implements best practices using `helmet`, rate limiting, and password hashing
- **Standardized Responses**: Global interceptors and exception filters for consistent API responses
- **Documentation**: Auto-generated Swagger/OpenAPI documentation
- **Docker Support**: Full Docker development and production setup with hot reload
- **Cloud Ready**: Production-ready GCP deployment with Cloud Run and Cloud SQL
- **Database Migrations**: Automatic PostgreSQL migrations with rollback support

## Prerequisites

- Node.js (v18 or later)
- [Bun 1.1+](https://bun.sh/) for dependency management and scripts
- PostgreSQL 16 (for local development)
- Docker and Docker Compose (for containerized development)
- gcloud CLI (for GCP deployment)

## Installation

```bash
bun install
```

## Running the Application

### Local Development (without Docker)

```bash
# Development mode
bun run start

# Watch mode (hot reload)
bun run start:dev

# Production mode
bun run start:prod
```

### Quick Start with Docker

```bash
# Copy environment file
cp .env.example .env

# Edit .env with your configuration
# Then start the application
docker-compose -f docker-compose.dev.yml up --build
```

The API will be available at `http://localhost:3000` with:
- ✅ Hot reload enabled
- ✅ PostgreSQL database automatically initialized
- ✅ All migrations applied automatically

## Testing

```bash
# Unit tests
bun run test

# E2E tests (requires .env.test)
bun run test:e2e

# Test coverage
bun run test:cov

# Specific test file
bun run test:e2e test/user-registration-real.e2e-spec.ts
```

---

## Docker Development

### Development Environment with Hot Reload

```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up --build

# Start in background
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f api-gateway

# Stop and cleanup
docker-compose -f docker-compose.dev.yml down

# Stop and remove all data (including database)
docker-compose -f docker-compose.dev.yml down -v
```

**Features:**
- Hot reload via volume mounts (`./:/app`)
- Automatic database migrations on startup
- PostgreSQL 16 with persistent data volume
- Health checks for API and database
- Network isolation with `blich-network`

### Development Tips

**View container status:**
```bash
docker-compose -f docker-compose.dev.yml ps
```

**Execute commands in containers:**
```bash
# API Gateway
docker-compose -f docker-compose.dev.yml exec api-gateway bun --version

# PostgreSQL
docker-compose -f docker-compose.dev.yml exec postgres psql -U postgres -d blich_studio
```

**Check health status:**
```bash
docker inspect --format='{{.State.Health.Status}}' blich-api-gateway-dev
```

### Troubleshooting Docker Development

**Hot reload not working:**
- On Linux, increase inotify watchers:
  ```bash
  echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf && sudo sysctl -p
  ```

**Port already in use:**
```bash
# Find process using port 3000
lsof -i :3000
# Kill process if needed
kill -9 <PID>
```

**Database connection issues:**
```bash
# Check database is running
docker-compose -f docker-compose.dev.yml exec postgres pg_isready -U postgres

# View database logs
docker-compose -f docker-compose.dev.yml logs postgres
```

---

## Docker Production

### Production Build and Deploy

```bash
# Build production image
docker build --build-arg NPM_TOKEN=$NPM_TOKEN -t blich-api-gateway:latest .

# Run production container
docker run -d \
  -p 3000:3000 \
  --env-file .env \
  --name blich-api-gateway \
  blich-api-gateway:latest

# Or use docker-compose
docker-compose up -d --build
```

### Production Docker Compose

```bash
# Start production environment
docker-compose up -d

# View logs
docker-compose logs -f api-gateway

# Scale service (if needed)
docker-compose up -d --scale api-gateway=3

# Stop environment
docker-compose down
```

### Production Docker Features

- **Multi-stage build**: Optimized image size (~100MB)
- **Non-root user**: Runs as `nestjs:1001` for security
- **Health checks**: Automatic container health monitoring
- **Automatic migrations**: Database migrations run on container init
- **Resource limits**: Set in docker-compose.yml for production
- **Persistent volumes**: Database data survives container restarts

### Production Best Practices

1. **Use specific image tags**, not `latest`:
   ```bash
   docker build -t blich-api-gateway:$(git rev-parse --short HEAD) .
   ```

2. **Set resource limits**:
   ```yaml
   deploy:
     resources:
       limits:
         cpus: '2'
         memory: 1G
       reservations:
         cpus: '0.5'
         memory: 512M
   ```

3. **Use secrets management**:
   ```bash
   docker secret create postgres_password ./postgres_password.txt
   ```

4. **Enable centralized logging**:
   ```yaml
   logging:
     driver: "json-file"
     options:
       max-size: "10m"
       max-file: "3"
   ```

5. **Regular backups**:
   ```bash
   docker-compose exec postgres pg_dump -U postgres blich_studio > backup.sql
   ```

---

## GCP Cloud Deployment

### Quick Deploy to GCP Cloud Run

**Automated Setup:**
```bash
# Set project ID
export GCP_PROJECT_ID="your-project-id"

# Run automated setup script
./scripts/gcp-setup.sh
```

**Manual Deploy:**
```bash
# Build and deploy using Cloud Build
gcloud builds submit \
  --config=cloudbuild.yaml \
  --substitutions=_NPM_TOKEN=$NPM_TOKEN
```

### GCP Architecture

```
GitHub → Cloud Build → Artifact Registry → Cloud Run → VPC Connector → Cloud SQL
                                              ↓
                                        Secret Manager
```

### GCP Components

| Component | Purpose | Configuration |
|-----------|---------|---------------|
| **Cloud Run** | Serverless container platform | Auto-scaling, 0-10 instances |
| **Cloud SQL** | Managed PostgreSQL 16 | Automatic backups, HA optional |
| **VPC Connector** | Private networking | Secure Cloud Run ↔ Cloud SQL |
| **Secret Manager** | Secrets storage | Environment variables |
| **Artifact Registry** | Docker images | europe-west1 region |
| **Cloud Build** | CI/CD pipeline | Automated builds on push |

### GCP Setup Steps

**1. Enable APIs:**
```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  sqladmin.googleapis.com \
  vpcaccess.googleapis.com \
  secretmanager.googleapis.com
```

**2. Create Artifact Registry:**
```bash
gcloud artifacts repositories create blich-studio \
  --repository-format=docker \
  --location=europe-west1 \
  --description="Blich Studio Docker images"
```

**3. Create Cloud SQL Instance:**
```bash
gcloud sql instances create blich-postgres-prod \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region=europe-west1 \
  --network=default \
  --no-assign-ip
```

**4. Create VPC Connector:**
```bash
gcloud compute networks vpc-access connectors create blich-vpc-connector \
  --region=europe-west1 \
  --network=default \
  --range=10.8.0.0/28
```

**5. Setup Secrets:**
```bash
echo -n "PROJECT_ID:REGION:INSTANCE_NAME" | gcloud secrets create POSTGRES_HOST --data-file=-
echo -n "your-password" | gcloud secrets create POSTGRES_PASSWORD --data-file=-
# ... create other secrets
```

**6. Deploy to Cloud Run:**
```bash
gcloud run deploy blich-api-gateway \
  --image europe-west1-docker.pkg.dev/$GCP_PROJECT_ID/blich-studio/blich-api-gateway:latest \
  --region europe-west1 \
  --platform managed \
  --allow-unauthenticated \
  --set-secrets POSTGRES_HOST=POSTGRES_HOST:latest,POSTGRES_PASSWORD=POSTGRES_PASSWORD:latest \
  --vpc-connector blich-vpc-connector
```

### GitHub Actions Deployment

The repository includes GitHub Actions workflow (`.github/workflows/deploy-gcp.yml`) for automated deployment:

**Setup:**
1. Create Workload Identity Provider (no service account keys needed)
2. Add GitHub secrets:
   - `GCP_PROJECT_ID`
   - `GCP_WORKLOAD_IDENTITY_PROVIDER`
   - `GCP_SERVICE_ACCOUNT`
   - `NPM_TOKEN`

**Deploy:**
- Push to `main` branch for staging
- Push to `production` branch for production
- Or trigger manually from GitHub Actions UI

### GCP Database Migrations

**Option A: Cloud SQL Proxy**
```bash
# Download proxy
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.darwin.amd64
chmod +x cloud-sql-proxy

# Start proxy
./cloud-sql-proxy PROJECT_ID:REGION:INSTANCE_NAME &

# Run migrations
psql -h localhost -U blich_app -d blich_studio -f database/migrations/001_user_registration.sql
```

**Option B: Cloud Run Job**
```bash
gcloud run jobs create db-migration \
  --image=europe-west1-docker.pkg.dev/$GCP_PROJECT_ID/blich-studio/blich-api-gateway:latest \
  --set-secrets POSTGRES_HOST=POSTGRES_HOST:latest \
  --vpc-connector=blich-vpc-connector \
  --args="-c,bun run migrate"

gcloud run jobs execute db-migration
```

### GCP Cost Estimates

**Staging Environment (~$22-32/month):**
- Cloud Run: $5-10 (minimal traffic, scale to zero)
- Cloud SQL db-f1-micro: $10-15
- VPC Connector: $7

**Production Environment (~$57-107/month):**
- Cloud Run: $20-50 (moderate traffic)
- Cloud SQL db-g1-small: $30-50
- VPC Connector: $7

**Cost Optimization Tips:**
- Set `min-instances=0` to scale to zero when idle
- Use `db-f1-micro` tier for staging
- Enable Cloud SQL connection pooling
- Set up budget alerts in GCP Console
- Monitor with Cloud Monitoring

### GCP Monitoring

**View Logs:**
```bash
# Stream logs
gcloud run services logs tail blich-api-gateway --follow

# View recent logs
gcloud run services logs read blich-api-gateway --limit=50
```

**Cloud Console:**
- [Cloud Run Dashboard](https://console.cloud.google.com/run)
- [Cloud SQL Dashboard](https://console.cloud.google.com/sql)
- [Logs Explorer](https://console.cloud.google.com/logs)

**Rollback:**
```bash
# List revisions
gcloud run revisions list --service=blich-api-gateway

# Rollback to previous revision
gcloud run services update-traffic blich-api-gateway --to-revisions=REVISION_NAME=100
```

---

## Documentation

### Swagger / OpenAPI

Once the application is running, you can access the Swagger documentation at:
http://localhost:3000/api/v1/docs

### GraphQL Playground

The GraphQL Playground is available at:
http://localhost:3000/graphql

## Environment Variables

Create a `.env` file from the example template:

```bash
cp .env.example .env
```

### Required Variables

```env
# Application
NODE_ENV=development                        # development | production
PORT=3000                                   # Application port
APP_URL=http://localhost:3000              # Base URL for email links

# PostgreSQL Database
POSTGRES_HOST=localhost                     # Database host
POSTGRES_PORT=5432                         # Database port
POSTGRES_USER=postgres                     # Database user
POSTGRES_PASSWORD=your_password            # Database password
POSTGRES_DB=blich_studio                   # Database name

# PostgreSQL SSL (for Cloud SQL)
POSTGRES_SSL=false                         # Enable SSL: true|false|1|0|yes|no
POSTGRES_SSL_REJECT_UNAUTHORIZED=true      # Verify SSL certificate
POSTGRES_SSL_CA=/path/to/ca.pem           # CA certificate path (optional)

# Authentication
BCRYPT_SALT_ROUNDS=12                      # Password hashing rounds (12 recommended)
VERIFICATION_TOKEN_EXPIRY_HOURS=24         # Email verification token expiry

# Email (requires implementation - see email.service.ts)
EMAIL_FROM=noreply@blichstudio.com         # Sender email address
COMPANY_NAME=Blich Studio                   # Company name in emails

# NPM (for private packages)
NPM_TOKEN=your-npm-token                   # NPM authentication token
```

### Optional Variables

```env
# Connection Pool Configuration
POSTGRES_POOL_MAX=20                       # Max connections (default: 20)
POSTGRES_IDLE_TIMEOUT=30000               # Idle timeout ms (default: 30000)
POSTGRES_CONNECTION_TIMEOUT=2000          # Connection timeout ms (default: 2000)

# Legacy (from original CMS integration)
CMS_API_URL=http://localhost:3001
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=60m
SUPABASE_URL=https://your-instance.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-key
```

### Environment-Specific Files

- `.env` - Local development (git-ignored)
- `.env.example` - Template with documentation
- `.env.test` - E2E test environment (git-ignored)

**⚠️ Important:** The application validates all required environment variables on startup and throws `MissingEnvironmentVariableError` if any are missing.

## Authentication Workflows

- **GraphQL (`/graphql`)**: `registerUser` and `loginUser` mutations authenticate Supabase users (web clients) and return gateway JWTs embedding the CMS role
- **REST (`/api/v1/admin/auth/login`)**: Admin panel sessions exchange Supabase credentials for a JWT that can call the protected editorial proxy routes
- **Email Verification (`/auth/*`)**: Email-based registration system with verification tokens

## REST Endpoints

### Authentication Endpoints

| Method | Path | Description | Rate Limit | Auth Required |
|--------|------|-------------|------------|---------------|
| `POST` | `/auth/register` | Register new user with email verification | 5 req/min | No |
| `POST` | `/auth/verify-email` | Verify email with token | 10 req/min | No |
| `POST` | `/auth/resend-verification` | Resend verification email | 3 req/min | No |
| `POST` | `/api/v1/admin/auth/login` | Admin login via Supabase | Default | No |

### Editorial Endpoints (Admin)

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| `PATCH` | `/api/v1/articles/:articleId` | Update article (admins: all, writers: own) | Yes |
| `PATCH` | `/api/v1/comments/:commentId` | Update comment (role-based access) | Yes |
| `DELETE` | `/api/v1/tags/:tagId` | Delete tag (admins only) | Yes |
| `POST` | `/api/v1/tags` | Create tag (admins only) | Yes |

**Response Format:** All REST routes return `{ "data": ... }` for success or `{ "error": ... }` for errors via the global `TransformInterceptor`.

## Architecture

This gateway uses the **BFF (Backend for Frontend)** pattern:

```
┌─────────────┐
│   Clients   │ (Web, Mobile, Admin Panel)
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────┐
│     API Gateway (NestJS)        │
│  ┌──────────┬──────────────┐    │
│  │ GraphQL  │     REST     │    │
│  │ /graphql │ /api/v1/*    │    │
│  └──────────┴──────────────┘    │
│  ┌─────────────────────────┐    │
│  │   Global Interceptors   │    │
│  │  Transform, Exception   │    │
│  └─────────────────────────┘    │
└──────┬──────────────┬───────────┘
       │              │
       ▼              ▼
┌─────────────┐  ┌──────────┐
│   CMS API   │  │PostgreSQL│
│ (Articles)  │  │  Users   │
└─────────────┘  └──────────┘
```

### Core Responsibilities

1. **Authentication**: Email-based registration with JWT tokens
2. **Request Routing**: Directs requests to appropriate microservices
3. **Data Aggregation**: Combines data from multiple sources
4. **Response Transformation**: Standardizes response formats
5. **Security**: Rate limiting, helmet, password hashing, SSL

### Module Structure

**AuthModule** - User registration and email verification
- Email-based registration with bcrypt password hashing
- SHA-256 token hashing with prefix optimization
- Verification token management with expiration
- Rate limiting (5/min register, 3/min resend)
- XSS-safe HTML email templates
- Timing attack protection

**EditorialModule** - CMS editorial operations
- Proxies REST operations to CMS API
- Role-based access control (admin, writer, reader)
- Article, comment, and tag management
- Ownership verification for writers

**ArticlesModule** - GraphQL article data
- Exposes article data via GraphQL schema
- Fetches from CMS API
- Caching and pagination

**UsersModule** - User management
- CMS user record persistence
- Role and ownership helpers
- User lookup and validation

**EmailModule** - Email notifications
- ⚠️ **NOT IMPLEMENTED** - Requires integration (SendGrid/AWS SES/Nodemailer)
- Currently logs to console in development
- HTML email templates with XSS protection

**DatabaseModule** - PostgreSQL connection
- Connection pooling with configurable limits
- SSL/TLS support for Cloud SQL
- Health checks and error handling
- Migration support

**ConfigModule** - Environment configuration
- Validates required environment variables on startup
- Type-safe configuration access
- Environment-specific settings

---

## User Registration & Email Verification

Complete email-based registration system with security best practices:

### Security Features

✅ **Password Hashing**: bcrypt with configurable salt rounds (default: 12)
✅ **Token Security**: SHA-256 hashing with prefix-based O(1) lookup
✅ **Timing Attack Protection**: Random delays and constant-time comparison
✅ **Rate Limiting**: Per-endpoint limits (5/min register, 3/min resend)
✅ **XSS Prevention**: HTML escaping in email templates
✅ **Database Constraints**: Unique email to prevent race conditions
✅ **SSL/TLS**: Configurable PostgreSQL SSL
✅ **Token Expiration**: Configurable expiry (default: 24 hours)
✅ **Automatic Cleanup**: Expired tokens removed (throttled, max 1/hour)

> **⚠️ CRITICAL: Email Provider Not Implemented**  
> Email sending is **NOT functional in production**. The system logs verification URLs to console in development. You **must** implement an email provider (SendGrid, AWS SES, or Nodemailer) in `src/modules/email/email.service.ts` before production deployment.

> **Maintainability Note**: Email templates are inline in `email.service.ts`. For production with multiple templates, extract to separate `.html` or `.hbs` files for easier maintenance, localization, and testing.

### Registration Endpoints

| Method | Path | Description | Rate Limit |
|--------|------|-------------|------------|
| `POST` | `/auth/register` | Register new user | 5 req/min |
| `POST` | `/auth/verify-email` | Verify email with token | 10 req/min |
| `POST` | `/auth/resend-verification` | Resend verification email | 3 req/min |

### API Examples

**Register:**
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!"
  }'

# Response: { "data": { "message": "Registration successful. Please check your email..." } }
```

**Verify Email:**
```bash
curl -X POST http://localhost:3000/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{ "token": "verification-token-from-email" }'

# Response: { "data": { "message": "Email verified successfully" } }
```

**Resend Verification:**
```bash
curl -X POST http://localhost:3000/auth/resend-verification \
  -H "Content-Type: application/json" \
  -d '{ "email": "user@example.com" }'

# Response: { "data": { "message": "Verification email sent..." } }
```

### Password Requirements

Passwords must meet all criteria:
- ✅ Minimum 8 characters
- ✅ At least one lowercase letter
- ✅ At least one uppercase letter
- ✅ At least one digit
- ✅ At least one special character

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `EMAIL_ALREADY_IN_USE` | 409 Conflict | Email is already registered |
| `INVALID_VERIFICATION_TOKEN` | 400 Bad Request | Token is invalid or doesn't exist |
| `VERIFICATION_TOKEN_EXPIRED` | 400 Bad Request | Token has expired |
| `EMAIL_ALREADY_VERIFIED` | 400 Bad Request | Email is already verified |
| `USER_NOT_FOUND` | 404 Not Found | No user with given email |

### Performance Optimizations

**Two-Part Token Structure:**
- **Token Prefix** (first 8 chars): Indexed for O(1) database queries
- **Token Hash**: SHA-256 hash of full token for secure verification

**Key Optimizations:**
1. **O(1) Token Lookup**: Composite index `(token_prefix, expires_at)` eliminates O(n) scans
2. **SHA-256 for Tokens**: 100x+ faster than bcrypt (tokens are random UUIDs, don't need intentional slowness)
3. **Throttled Cleanup**: Expired token cleanup max once per hour (async, non-blocking)
4. **Early Email Validation**: Check email existence before expensive bcrypt hashing
5. **Connection Pooling**: Configurable PostgreSQL pool for optimal throughput

> **Note**: `TOKEN_PREFIX_LENGTH` constant (8 chars) must match database schema `VARCHAR(8)` in migration `002_add_token_prefix.sql`

**Production Scaling:**
- For high-traffic apps, use scheduled cron job for token cleanup instead of app-level throttling
- Consider `pg_cron` extension or system cron
- Monitor connection pool usage and adjust `POSTGRES_POOL_MAX`

### Implementation Details

**Hashing Strategy:**
- **Passwords**: bcrypt (intentionally slow, configurable salt rounds)
- **Tokens**: SHA-256 (fast, cryptographically secure, tokens are random UUIDs)

**Timing Attack Protection:**
- Random delays (50-150ms) on verification failures
- Constant-time token comparison using `Buffer.compare()`
- All tokens checked to prevent early exit timing leaks

**Race Condition Prevention:**
- Database unique constraint on email (PostgreSQL error code 23505)
- Handles concurrent registration attempts gracefully

**Startup Validation:**
- Validates all required environment variables
- Checks `TOKEN_PREFIX_LENGTH` matches database schema
- Throws `MissingEnvironmentVariableError` if configuration invalid

---

## Project Scripts

### Development
```bash
bun run start          # Start application
bun run start:dev      # Start with hot reload
bun run start:prod     # Start in production mode
```

### Testing
```bash
bun run test           # Unit tests
bun run test:watch     # Unit tests in watch mode
bun run test:e2e       # E2E tests
bun run test:cov       # Coverage report
```

### Quality Checks
```bash
bun run lint           # ESLint
bun run typecheck      # TypeScript check
bun run format         # Prettier format
```

### Docker
```bash
docker-compose -f docker-compose.dev.yml up --build    # Dev environment
docker-compose up --build                              # Production build
```

### GCP Deployment
```bash
./scripts/gcp-setup.sh                     # Automated GCP setup
gcloud builds submit --config=cloudbuild.yaml  # Deploy to Cloud Run
```

---

## Database Setup

### Local PostgreSQL Setup

```bash
# Create database
psql -U postgres -c "CREATE DATABASE blich_studio;"

# Run migrations
export PGPASSWORD="your-password"
psql -h localhost -p 5432 -U postgres -d blich_studio -f database/migrations/001_user_registration.sql
psql -h localhost -p 5432 -U postgres -d blich_studio -f database/migrations/002_add_token_prefix.sql
unset PGPASSWORD
```

### Docker PostgreSQL (Automatic)

When using `docker-compose.dev.yml` or `docker-compose.yml`, migrations run automatically on first startup via mounted volume:
```yaml
volumes:
  - ./database/migrations:/docker-entrypoint-initdb.d
```

### Database Schema

**Users Table:**
```sql
- id: UUID PRIMARY KEY
- email: VARCHAR(255) UNIQUE NOT NULL
- password_hash: TEXT NOT NULL
- is_verified: BOOLEAN DEFAULT FALSE
- created_at: TIMESTAMP DEFAULT NOW()
- updated_at: TIMESTAMP DEFAULT NOW()
```

**Verification Tokens Table:**
```sql
- id: UUID PRIMARY KEY
- token_hash: VARCHAR(64) NOT NULL  -- SHA-256 hash
- token_prefix: VARCHAR(8) NOT NULL -- First 8 chars for fast lookup
- user_id: UUID REFERENCES users(id)
- expires_at: TIMESTAMP NOT NULL
- created_at: TIMESTAMP DEFAULT NOW()
```

**Indexes:**
- `idx_users_email` - Fast email lookup
- `idx_verification_tokens_prefix_expires` - O(1) token lookup
- `idx_verification_tokens_user_id` - User token lookup

### Rollback Migrations

Rollback scripts are in `database/rollbacks/`:

```bash
# Rollback token prefix migration
psql -U postgres -d blich_studio -f database/rollbacks/002_add_token_prefix_down.sql

# Rollback user registration
psql -U postgres -d blich_studio -f database/rollbacks/001_user_registration_down.sql
```

**⚠️ Warning:** Token prefix migration rollback is **destructive** - all verification tokens will be deleted (tokens are hashed with SHA-256, making prefix extraction impossible).

### Database Migrations Script

Use the provided migration script:
```bash
./scripts/migrate-token-prefix.sh
```

---

## Deployment

### CI/CD Pipeline

The project uses GitHub Actions for continuous integration:

**Workflow:** `.github/workflows/ci.yml`
- ✅ TypeScript type checking
- ✅ ESLint linting
- ✅ Unit tests (41 tests)
- ✅ E2E tests (18 tests with real database)

**Trigger:** Runs on push to `development` and `main` branches

### Pre-commit Hooks

Husky pre-commit hooks run automatically:
```bash
# Runs before each commit
- TypeScript typecheck
- ESLint
```

**Configure:** `.husky/pre-commit`

### Production Deployment Options

**1. Docker Compose (Simple)**
```bash
docker-compose up -d --build
```

**2. Docker Registry Push**
```bash
# Build and tag
docker build -t gcr.io/your-project/blich-api-gateway:$(git rev-parse --short HEAD) .

# Push to registry
docker push gcr.io/your-project/blich-api-gateway:latest
```

**3. GCP Cloud Run (Recommended)**
```bash
# Automated via Cloud Build
gcloud builds submit --config=cloudbuild.yaml

# Or via GitHub Actions
git push origin main
```

**4. Manual Cloud Run Deploy**
```bash
gcloud run deploy blich-api-gateway \
  --image=europe-west1-docker.pkg.dev/$GCP_PROJECT_ID/blich-studio/blich-api-gateway:latest \
  --region=europe-west1 \
  --platform=managed
```

### Environment-Specific Deployments

**Staging:**
- Branch: `main`
- Cloud Run: `min-instances=0`, `max-instances=3`
- Cloud SQL: `db-f1-micro`

**Production:**
- Branch: `production`
- Cloud Run: `min-instances=1`, `max-instances=10`
- Cloud SQL: `db-g1-small` with HA

---

## Monitoring and Troubleshooting

### Health Checks

**Application Health:**
```bash
curl http://localhost:3000/
# Expected: 200 OK
```

**Database Health:**
```bash
# Docker
docker-compose exec postgres pg_isready -U postgres

# Cloud SQL
gcloud sql instances describe blich-postgres-prod --format='value(state)'
```

### View Logs

**Local Development:**
```bash
# Application logs
tail -f logs/app.log

# Docker logs
docker-compose logs -f api-gateway
```

**Production (GCP):**
```bash
# Stream logs
gcloud run services logs tail blich-api-gateway --follow

# Recent logs
gcloud run services logs read blich-api-gateway --limit=50
```

### Common Issues

**Port already in use:**
```bash
# Find process
lsof -i :3000
# Kill process
kill -9 <PID>
```

**Database connection failed:**
```bash
# Check PostgreSQL is running
ps aux | grep postgres

# Test connection
psql -h localhost -U postgres -d blich_studio -c "SELECT 1;"
```

**Docker container not starting:**
```bash
# Check container logs
docker logs blich-api-gateway

# Inspect container
docker inspect blich-api-gateway

# Check health status
docker inspect --format='{{.State.Health.Status}}' blich-api-gateway
```

**Migrations not running:**
```bash
# Check migration files exist
ls -la database/migrations/

# Run manually
docker-compose exec postgres psql -U postgres -d blich_studio -f /docker-entrypoint-initdb.d/001_user_registration.sql
```

**Hot reload not working (Docker):**
```bash
# Linux - increase inotify watchers
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

### Performance Monitoring

**Cloud Run Metrics:**
- Request latency
- Container instance count
- CPU and memory utilization
- Request count and error rate

**Cloud SQL Metrics:**
- Connection count
- Query performance
- Storage usage
- Backup status

**Set up alerts:**
```bash
gcloud monitoring uptime-checks create http blich-api-gateway-health \
  --display-name="API Health Check" \
  --resource-type=uptime-url
```

### Debug Mode

Enable debug logging:
```bash
# Set environment variable
DEBUG=* bun run start:dev

# Or in .env
LOG_LEVEL=debug
```

---

## Testing

### Test Suite Overview

**Unit Tests (41 tests):**
- DTO validation
- Service logic
- Controller endpoints
- Interceptors and filters
- Email service

**E2E Tests (18 tests):**
- Complete registration flow
- Email verification
- Token expiration
- Rate limiting
- Error handling

### Running Tests

```bash
# All unit tests
bun run test

# Watch mode
bun run test:watch

# Specific file
bun run test src/modules/auth/user-auth.service.spec.ts

# All E2E tests
bun run test:e2e

# Specific E2E test
bun run test:e2e test/user-registration-real.e2e-spec.ts

# Coverage report
bun run test:cov
```

### E2E Test Configuration

Create `.env.test`:
```env
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=test_password
POSTGRES_DB=blich_studio_test
BCRYPT_SALT_ROUNDS=4
VERIFICATION_TOKEN_EXPIRY_HOURS=24
```

### Test Coverage

The comprehensive test suite covers:
- ✅ Successful registration flow
- ✅ Duplicate email handling
- ✅ Invalid password formats (8 char min, uppercase, lowercase, digit, special)
- ✅ Email verification success/failure
- ✅ Token expiration scenarios
- ✅ Token prefix optimization (O(1) lookup)
- ✅ Resend verification functionality
- ✅ Rate limiting enforcement
- ✅ XSS-safe email templates
- ✅ Timing attack protection
- ✅ Database constraint handling
- ✅ Error code consistency

---

## Contributing

### Code Quality

- **TypeScript**: Strict mode enabled
- **ESLint**: Enforced via pre-commit hooks
- **Prettier**: Consistent code formatting
- **Testing**: 100% coverage target for critical paths
- **Commits**: Conventional commits enforced via commitlint

### Development Workflow

1. Create feature branch from `development`
2. Make changes with tests
3. Run quality checks: `bun run typecheck && bun run lint && bun run test`
4. Commit with conventional format: `feat: add new feature`
5. Push and create PR to `development`

### CI/CD Pipeline

**Continuous Integration** (`.github/workflows/ci.yml`):
- TypeScript typecheck
- ESLint linting
- Unit tests (41 tests)
- E2E tests (18 tests with real database)

**Deployment** (`.github/workflows/deploy-gcp.yml`):
- Build Docker image
- Push to Artifact Registry
- Deploy to Cloud Run
- Health check validation

---

## License

This project is proprietary and confidential.

## Support

- **Issues**: Create GitHub issue in this repository
- **Documentation**: This README is the primary documentation source
- **Cloud Run**: https://console.cloud.google.com/run
- **Cloud SQL**: https://console.cloud.google.com/sql

---

## Project Status

**Version**: 1.0.0  
**Last Updated**: December 2025  
**Build Status**: ✅ Passing  
**Test Coverage**: 59 tests (41 unit, 18 E2E)  
**Production Ready**: ✅ Yes (requires email provider implementation)

### Technology Stack

- **Runtime**: Bun 1.1+
- **Framework**: NestJS 10.x
- **Database**: PostgreSQL 16
- **Testing**: Vitest 4.0.14
- **Container**: Docker with Bun Alpine
- **Cloud**: GCP Cloud Run + Cloud SQL
- **CI/CD**: GitHub Actions
- **Language**: TypeScript 5.7.3

---

**Built with ❤️ by Blich Studio**
