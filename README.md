# Blich Studio API Gateway

NestJS-based API Gateway providing authentication, user management, and GraphQL/REST interface for Blich Studio applications.

## Features

- ✅ JWT authentication with email verification
- ✅ GraphQL and REST APIs
- ✅ PostgreSQL database with migrations
- ✅ Docker development environment
- ✅ Production-ready GCP deployment (Cloud Run + Cloud SQL)
- ✅ Automated CI/CD with Cloud Build

## Quick Start

```bash
# 1. Install dependencies
bun install

# 2. Setup environment
cp .env.example .env

# 3. Start development
docker-compose -f docker-compose.dev.yml up --build
```

API available at: `http://localhost:3000`

## Development

### With Docker (Recommended)

```bash
# Start
docker-compose -f docker-compose.dev.yml up

# Stop
docker-compose -f docker-compose.dev.yml down

# View logs
docker-compose -f docker-compose.dev.yml logs -f api-gateway
```

### Without Docker

Requires PostgreSQL 16 running locally:

```bash
# Development with hot reload
bun run start:dev

# Production mode
bun run start:prod
```

## Testing

```bash
# Unit tests
bun run test

# E2E tests
bun run test:e2e

# Coverage
bun run test:cov
```

## Environment Variables

Key variables (see `.env.example` for full list):

```env
# Application
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000

# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
POSTGRES_DB=blich_studio
POSTGRES_SSL=false

# Authentication
BCRYPT_SALT_ROUNDS=12
VERIFICATION_TOKEN_EXPIRY_HOURS=24

# Email
EMAIL_FROM=noreply@blichstudio.com
COMPANY_NAME=Blich Studio

# NPM (for private packages)
NPM_TOKEN=your-npm-token
```

## API Documentation

- **Swagger/OpenAPI**: http://localhost:3000/api/v1/docs
- **GraphQL Playground**: http://localhost:3000/graphql

## GCP Production Deployment

### Architecture

```
GitHub → Cloud Build → Artifact Registry → Cloud Run → VPC → Cloud SQL
                                             ↓
                                       Secret Manager
```

### One-Time Setup

**1. Configure GCP Project**

```bash
export GCP_PROJECT_ID="blichstudio-infras"
export GCP_REGION="europe-west1"
export PROJECT_NUMBER=$(gcloud projects describe $GCP_PROJECT_ID --format='value(projectNumber)')

gcloud config set project $GCP_PROJECT_ID
gcloud config set run/region $GCP_REGION
```

**2. Enable APIs**

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  vpcaccess.googleapis.com
```

**3. Create Artifact Registry**

```bash
gcloud artifacts repositories create blich-studio \
  --repository-format=docker \
  --location=$GCP_REGION \
  --description="Blich Studio Docker images"

gcloud auth configure-docker $GCP_REGION-docker.pkg.dev
```

**4. Create VPC Connector** (if not exists)

```bash
export VPC_CONNECTOR_NAME="blich-vpc-connector"

gcloud compute networks vpc-access connectors create $VPC_CONNECTOR_NAME \
  --region=$GCP_REGION \
  --network=default \
  --range=10.8.0.0/28 \
  --min-instances=2 \
  --max-instances=3 \
  --machine-type=f1-micro
```

**5. Create Secrets**

```bash
# Database credentials (use your actual Cloud SQL values)
echo -n "10.36.0.3" | gcloud secrets create POSTGRES_HOST --data-file=-
echo -n "5432" | gcloud secrets create POSTGRES_PORT --data-file=-
echo -n "blich_app" | gcloud secrets create POSTGRES_USER --data-file=-
echo -n "your-db-password" | gcloud secrets create POSTGRES_PASSWORD --data-file=-
echo -n "blich_studio" | gcloud secrets create POSTGRES_DB --data-file=-
echo -n "false" | gcloud secrets create POSTGRES_SSL --data-file=-

# App config
echo -n "12" | gcloud secrets create BCRYPT_SALT_ROUNDS --data-file=-
echo -n "24" | gcloud secrets create VERIFICATION_TOKEN_EXPIRY_HOURS --data-file=-

# NPM token for private packages
echo -n "your-npm-token" | gcloud secrets create NPM_TOKEN_CLOUDBUILD --data-file=-
```

**6. Grant Permissions**

```bash
# Cloud Run access to secrets
gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Cloud Build permissions
gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Cloud Build P4SA access to NPM token
gcloud secrets add-iam-policy-binding NPM_TOKEN_CLOUDBUILD \
  --member="serviceAccount:service-${PROJECT_NUMBER}@gcp-sa-cloudbuild.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

**7. Setup GitHub Connection** (for automated deployments)

```bash
# Create connection (opens browser for auth)
gcloud builds connections create github "blich-studio-github" --region=$GCP_REGION

# Link repository
gcloud alpha builds repositories create api-gateway \
  --remote-uri=https://github.com/Blich-Studio/api-gateway.git \
  --connection=blich-studio-github \
  --region=$GCP_REGION
```

**8. Create Cloud Build Trigger**

Via GCP Console (recommended):
1. Go to: https://console.cloud.google.com/cloud-build/triggers
2. Click **CREATE TRIGGER**
3. Configure:
   - **Name**: `blich-api-gateway-deploy`
   - **Region**: `europe-west1`
   - **Event**: Push to a branch
   - **Source**: 2nd gen
   - **Repository**: `api-gateway`
   - **Branch**: `^main$`
   - **Configuration**: `cloudbuild.yaml`
   - **Substitution variables**: 
     - `_VPC_CONNECTOR` = `blich-vpc-connector`
4. Click **CREATE**

### Deployment

**Automatic** (recommended):
```bash
git push origin main
```

**Manual**:
```bash
gcloud builds submit \
  --config=cloudbuild.yaml \
  --substitutions=_VPC_CONNECTOR=$VPC_CONNECTOR_NAME,_IMAGE_TAG=manual-$(date +%Y%m%d-%H%M%S)
```

### Testing the Deployed Service

```bash
# Get authentication token (valid 1 hour)
export TOKEN=$(gcloud auth print-identity-token)

# Get service URL
export SERVICE_URL=$(gcloud run services describe blich-api-gateway \
  --region=$GCP_REGION \
  --format='value(status.url)')

# Test health endpoint
curl -H "Authorization: Bearer $TOKEN" $SERVICE_URL

# Test registration endpoint
curl -X POST $SERVICE_URL/auth/register \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123!"}'
```

### Custom Domain (Optional)

```bash
# Create domain mapping
gcloud beta run domain-mappings create \
  --service=blich-api-gateway \
  --domain=api.yourdomain.com \
  --region=$GCP_REGION
```

Then add DNS record at your domain provider:
- **Type**: CNAME
- **Name**: api
- **Value**: ghs.googlehosted.com.

### Monitoring & Logs

```bash
# Stream logs
gcloud run services logs tail blich-api-gateway --region=$GCP_REGION --follow

# View recent logs
gcloud run services logs read blich-api-gateway --region=$GCP_REGION --limit=50

# View build history
gcloud builds list --limit=10

# Check service status
gcloud run services describe blich-api-gateway --region=$GCP_REGION
```

### Rollback

```bash
# List revisions
gcloud run revisions list --service=blich-api-gateway --region=$GCP_REGION

# Rollback to previous revision
gcloud run services update-traffic blich-api-gateway \
  --to-revisions=REVISION_NAME=100 \
  --region=$GCP_REGION
```

## Database Migrations

Migrations are located in `database/migrations/` and run automatically on container startup.

**Manual migration** (via Cloud SQL Proxy):

```bash
# Download Cloud SQL Proxy
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.darwin.amd64
chmod +x cloud-sql-proxy

# Start proxy
./cloud-sql-proxy PROJECT_ID:REGION:INSTANCE_NAME &

# Run migrations
psql -h localhost -U blich_app -d blich_studio -f database/migrations/001_user_registration.sql

# Stop proxy
pkill cloud-sql-proxy
```

## Troubleshooting

### Docker Issues

**Port already in use:**
```bash
lsof -i :3000
kill -9 <PID>
```

**Database connection failed:**
```bash
docker-compose -f docker-compose.dev.yml logs postgres
docker-compose -f docker-compose.dev.yml exec postgres pg_isready -U postgres
```

### GCP Issues

**Build failed:**
```bash
gcloud builds log <BUILD_ID>
gcloud builds list --limit=5
```

**Service won't start:**
```bash
gcloud run services logs read blich-api-gateway --region=$GCP_REGION --limit=100
gcloud run services describe blich-api-gateway --region=$GCP_REGION
```

**Secrets not accessible:**
```bash
gcloud secrets list
gcloud secrets get-iam-policy SECRET_NAME
```

## Architecture

```
src/
├── app.module.ts           # Main application module
├── main.ts                 # Application entry point
├── common/                 # Shared utilities
│   ├── filters/            # Exception filters
│   └── interceptors/       # Response interceptors
├── config/                 # Configuration management
├── modules/
│   ├── auth/              # Authentication & email verification
│   ├── users/             # User management
│   ├── articles/          # Articles (GraphQL)
│   ├── editorial/         # Editorial proxy
│   └── supabase/          # Supabase integration
database/
├── migrations/            # SQL migration files
└── scripts/              # Database utilities
```

## Cost Estimates

**GCP Production (~$20-60/month)**:
- Cloud Run: $5-30 (auto-scales to zero)
- Cloud SQL: $10-25 (db-f1-micro or higher)
- VPC Connector: $7
- Artifact Registry: ~$1
- Cloud Build: Free (120 build-min/day)

## License

Proprietary - Blich Studio

## Support

For issues or questions, contact: admin@blichstudio.com
