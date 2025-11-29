# Blich Studio API Gateway

The API Gateway for Blich Studio, built with [NestJS](https://nestjs.com/). This service acts as the entry point for client applications, aggregating data from various microservices (like the CMS API) and providing a unified GraphQL and REST interface.

## Features

- **GraphQL Interface**: Aggregates data from backend services (e.g., CMS API) into a single GraphQL schema.
- **Authentication**: JWT-based authentication strategy.
- **Security**: Implements best practices using `helmet` and rate limiting.
- **Standardized Responses**: Global interceptors and exception filters for consistent API responses.
- **Documentation**: Auto-generated Swagger/OpenAPI documentation.

## Prerequisites

- Node.js (v18 or later)
- [Bun 1.1+](https://bun.sh/) for dependency management and scripts
- Running instance of `cms-api` (default: http://localhost:3001)

## Installation

```bash
$ bun install
```

## Running the app

```bash
# development
$ bun run start

# watch mode
$ bun run start:dev

# production mode
$ bun run start:prod
```

## Test

```bash
# unit tests
$ bun run test

# e2e tests
$ bun run test:e2e

# test coverage
$ bun run test:cov
```

## Documentation

### Swagger / OpenAPI

Once the application is running, you can access the Swagger documentation at:
http://localhost:3000/api/v1/docs

### GraphQL Playground

The GraphQL Playground is available at:
http://localhost:3000/graphql

## Environment Variables

Create a `.env` file in the root of the application (if not using the global configuration). The gateway now throws a `MissingEnvironmentVariableError` during boot if any of the following values are absent or invalid:

```env
PORT=3000
CMS_API_URL=http://localhost:3001
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=60m
SUPABASE_URL=https://your-supabase-instance.supabase.co
SUPABASE_SERVICE_ROLE_KEY=service-role-key
```

Adjust the values to match your local Supabase project and CMS API endpoint before running `bun run start:dev` or the e2e tests.

### Authentication Workflows

- **GraphQL (`/graphql`)**: `registerUser` and `loginUser` mutations authenticate Supabase users (web clients) and return gateway JWTs embedding the CMS role.
- **REST (`/api/v1/admin/auth/login`)**: Admin panel sessions exchange Supabase credentials for a JWT that can call the protected editorial proxy routes listed below.

### REST Endpoints

| Method   | Path                          | Description                                                                                          |
| -------- | ----------------------------- | ---------------------------------------------------------------------------------------------------- |
| `POST`   | `/api/v1/admin/auth/login`    | Authenticates an admin via Supabase credentials and issues a gateway-scoped JWT.                     |
| `PATCH`  | `/api/v1/articles/:articleId` | Updates an article. Admins can edit everything; writers are limited to their own articles.           |
| `PATCH`  | `/api/v1/comments/:commentId` | Updates a comment. Admins can edit everything; readers and writers can only edit their own comments. |
| `DELETE` | `/api/v1/tags/:tagId`         | Deletes a tag. Only admins are allowed.                                                              |
| `POST`   | `/api/v1/tags`                | Creates a tag. Only admins are allowed.                                                              |

All REST routes return `{ "data": ... }` payloads via the global `TransformInterceptor` and require a Bearer token produced by the `/admin/auth/login` endpoint.

## Architecture

This gateway uses the **BFF (Backend for Frontend)** pattern. It is responsible for:

1.  Authenticating users.
2.  Routing requests to appropriate microservices.
3.  Aggregating and transforming data for the frontend.

### Modules

- **AuthModule**: Handles user registration, email verification, and authentication. Uses PostgreSQL for storing user credentials and verification tokens.
- **EditorialModule**: Proxies editorial REST operations (articles, comments, tags) to the CMS API while enforcing role-based access rules.
- **ArticlesModule**: Exposes article data via GraphQL, fetching from the CMS API.
- **UsersModule**: Persists CMS user records through POST/GET proxies and centralizes role/ownership helpers for GraphQL and REST flows.

## User Registration & Email Verification

The API Gateway includes a complete user registration system with email verification:

### Features

- ✅ Email-based registration with secure password hashing (bcrypt)
- ✅ Email verification with expiring tokens (configurable, default 24 hours)
- ✅ Rate limiting to prevent abuse (5 req/min for registration, 3 req/min for resend)
- ✅ XSS-safe HTML email templates with proper escaping
- ✅ Optimized token lookup with prefix-based indexing (O(1) performance)
- ✅ Timing attack protection with random delays
- ✅ Comprehensive error handling with specific error codes
- ✅ Rollback migrations included

> **Note**: Email templates are currently inline in the code. For better maintainability when adding more templates, consider extracting them to separate `.html` or `.hbs` files.

### REST Endpoints

| Method | Path                             | Description                                    | Rate Limit     |
| ------ | -------------------------------- | ---------------------------------------------- | -------------- |
| `POST` | `/auth/register`                 | Register a new user with email verification    | 5 req/min      |
| `POST` | `/auth/verify-email`             | Verify email with token from email             | 10 req/min     |
| `POST` | `/auth/resend-verification`      | Resend verification email                      | 3 req/min      |

### Environment Variables

Add these to your `.env` file:

```env
# PostgreSQL Configuration (Cloud SQL)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=api_gateway
POSTGRES_USER=your_user
POSTGRES_PASSWORD=your_password

# PostgreSQL SSL Configuration (for Cloud SQL)
POSTGRES_SSL=true                          # Enable SSL connection (case-insensitive: true/TRUE/True)
POSTGRES_SSL_REJECT_UNAUTHORIZED=true      # Verify SSL certificate (case-insensitive)
POSTGRES_SSL_CA=/path/to/server-ca.pem     # Path to CA certificate (optional)

# Email Configuration
EMAIL_SERVICE=gmail                         # Or your SMTP service
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=noreply@blichstudio.com

# Verification Token Configuration
VERIFICATION_TOKEN_EXPIRY_HOURS=24          # Default: 24 hours
BCRYPT_SALT_ROUNDS=12                       # Default: 12 rounds (for passwords only)

# Application URL
APP_URL=http://localhost:3000               # Used for verification URLs
```

### Database Setup

1. **Run the initial migration:**
   
   If using the provided setup script:
   ```bash
   # From the project root
   ./scripts/setup-registration.sh
   ```
   
   Or manually with psql:
   ```bash
   export PGPASSWORD="${POSTGRES_PASSWORD}"
   psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -f database/migrations/001_user_registration.sql
   unset PGPASSWORD
   ```

2. **Apply the token optimization migration:**
   ```bash
   ./scripts/migrate-token-prefix.sh
   ```
   
   ⚠️ **IMPORTANT**: This migration is **destructive** and will delete all existing verification tokens. This is necessary because tokens are hashed with SHA-256 (one-way encryption), making it impossible to extract the prefix from existing tokens. Users with pending verifications will need to request new verification emails. Run during low-traffic periods.

The migrations create:
- `users` table with UUID, email, password_hash, is_verified
- `verification_tokens` table with token hash, token_prefix, user_id, expires_at
- Indexes for efficient lookups
- Trigger to auto-update updated_at timestamp

### Password Requirements

Passwords must:
- Be at least 8 characters long
- Contain at least one lowercase letter
- Contain at least one uppercase letter
- Contain at least one digit
- Contain at least one special character

### Error Codes

| Code                           | Description                                    |
| ------------------------------ | ---------------------------------------------- |
| `EMAIL_ALREADY_IN_USE`         | Email is already registered                    |
| `INVALID_VERIFICATION_TOKEN`   | Token is invalid or doesn't exist              |
| `VERIFICATION_TOKEN_EXPIRED`   | Token has expired (past expiry time)           |
| `EMAIL_ALREADY_VERIFIED`       | User's email is already verified               |
| `USER_NOT_FOUND`               | No user found with given email                 |

### Security Features

1. **Password Hashing**: bcrypt with configurable salt rounds (default: 12) for secure, intentionally slow hashing
2. **Token Security**: 
   - Tokens always hashed with SHA-256 (fast, cryptographically secure - not configurable)
   - SHA-256 chosen over bcrypt: tokens are random UUIDs and don't need intentional slowness
   - Prefix-based lookup for O(1) query performance
   - Constant-time comparison using Buffer.compare() to prevent timing attacks
   - Configurable expiration (default: 24 hours)
   - Only first 8 characters logged in development mode
   - Automatic cleanup of expired tokens (async, non-blocking)
3. **Timing Attack Protection**: 
   - Random delays (50-150ms) on verification failures to prevent enumeration
   - Constant-time token comparison (all tokens checked to prevent early exit timing leaks)
4. **Race Condition Prevention**: Email existence checked before expensive password hashing to prevent CPU waste
5. **Rate Limiting**: Per-endpoint limits to prevent abuse (5 req/min register, 3 req/min resend)
6. **XSS Prevention**: HTML escaping for all user-provided content in email templates
7. **SSL/TLS**: Configurable PostgreSQL SSL with certificate verification (CA cert optional, robust boolean parsing for 'true', '1', 'yes')

### Performance Optimizations

The system uses a two-part token structure for efficient lookup:
- **Token Prefix** (first 8 chars): Indexed for fast database queries
- **Token Hash**: SHA-256 hash of full token for secure verification

This avoids the O(n) performance issue of comparing every unexpired token. SHA-256 provides 100x+ faster hashing than bcrypt while maintaining cryptographic security for tokens.

### Testing

Run the comprehensive E2E test suite:

```bash
bun run test:e2e test/user-registration.e2e-spec.ts
```

The test suite covers:
- Successful registration flow
- Duplicate email handling
- Invalid password formats
- Email verification success/failure
- Token expiration scenarios
- Resend verification functionality
