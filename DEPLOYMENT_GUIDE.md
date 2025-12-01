# Step-by-Step GCP Deployment Guide

Complete guide to deploy Blich Studio API Gateway to Google Cloud Platform using **Cloud Build** and **existing Cloud SQL**.

## Deployment Strategy

This guide uses **Cloud Build** (recommended) since you already have Cloud SQL running:

✅ **Advantages:**
- No secrets management needed (native IAM)
- Direct VPC access to existing Cloud SQL
- Faster builds (same region)
- Auto-deploy on git push
- Can run migrations during deployment

**Total Time: ~20-30 minutes** (vs 60+ minutes for full setup)

---

## Prerequisites Checklist

Before starting, ensure you have:

- [ ] GCP account with billing enabled
- [ ] `gcloud` CLI installed ([Download](https://cloud.google.com/sdk/docs/install))
- [ ] **Existing Cloud SQL PostgreSQL instance running**
- [ ] Cloud SQL connection name and credentials
- [ ] Project code ready to deploy
- [ ] NPM token for private packages
- [ ] GitHub repository access

---

## Step 1: GCP Project Setup (2 minutes)

### 1.1 Login and Set Project

```bash
# Login to GCP
gcloud auth login

# List your projects
gcloud projects list

# Set your existing project (where Cloud SQL is running)
export GCP_PROJECT_ID="blichstudio-infras"
gcloud config set project $GCP_PROJECT_ID

# Set region (Cloud Run uses regions, not zones - remove the zone suffix)
export GCP_REGION="europe-west1"  # Region only (not europe-west1-c)
gcloud config set run/region $GCP_REGION

# Get project number (needed later)
export PROJECT_NUMBER=$(gcloud projects describe $GCP_PROJECT_ID --format='value(projectNumber)')
```

**Verify:**
```bash
gcloud config list
echo "Project: $GCP_PROJECT_ID"
echo "Region: $GCP_REGION"
echo "Project Number: $PROJECT_NUMBER"
```

---

## Step 2: Enable Required APIs (2 minutes)

```bash
# Enable only the APIs needed for Cloud Build deployment
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  vpcaccess.googleapis.com
```

**Note:** `sqladmin.googleapis.com` should already be enabled since you have Cloud SQL running.

**Verify:**
```bash
gcloud services list --enabled | grep -E 'run|build|artifact|secret|vpc'
```

---

## Step 3: Create Artifact Registry (2 minutes)

This stores your Docker images.

```bash
# Create repository
gcloud artifacts repositories create blich-studio \
  --repository-format=docker \
  --location=$GCP_REGION \
  --description="Blich Studio Docker images"

# Configure Docker authentication
gcloud auth configure-docker $GCP_REGION-docker.pkg.dev
```

**Verify:**
```bash
gcloud artifacts repositories list --location=$GCP_REGION
```

---

## Step 4: Configure Existing Cloud SQL (3 minutes)

Since you already have Cloud SQL running, just gather the connection details.

### 4.1 List Your Cloud SQL Instances

```bash
# List all instances
gcloud sql instances list

# Example output:
# NAME                DATABASE_VERSION  LOCATION        TIER         STATUS
# my-postgres-prod    POSTGRES_16       europe-west1-b  db-f1-micro  RUNNABLE
```

### 4.2 Set Your Instance Name

```bash
# Replace with your actual instance name
export SQL_INSTANCE_NAME="my-postgres-prod"

# Get connection name
export POSTGRES_CONNECTION_NAME=$(gcloud sql instances describe $SQL_INSTANCE_NAME --format='value(connectionName)')
echo "Connection name: $POSTGRES_CONNECTION_NAME"

# Save for later
echo "POSTGRES_CONNECTION_NAME=$POSTGRES_CONNECTION_NAME" >> ~/gcp-credentials.txt
```

### 4.3 Verify Database and User Exist

```bash
# List databases
gcloud sql databases list --instance=$SQL_INSTANCE_NAME

# List users
gcloud sql users list --instance=$SQL_INSTANCE_NAME
```

### 4.4 Create Database if Needed

If you don't have a database for the API Gateway yet:

```bash
# Create database
gcloud sql databases create blich_studio \
  --instance=$SQL_INSTANCE_NAME

# Create application user (if needed)
POSTGRES_APP_PASSWORD=$(openssl rand -base64 32)
echo "App password: $POSTGRES_APP_PASSWORD" >> ~/gcp-credentials.txt

gcloud sql users create blich_app \
  --instance=$SQL_INSTANCE_NAME \
  --password="$POSTGRES_APP_PASSWORD"
```

### 4.5 Note Your Credentials

You'll need these for secrets (next step):
- **POSTGRES_HOST**: `$POSTGRES_CONNECTION_NAME` (the full connection name)
- **POSTGRES_USER**: Your database username (e.g., `blich_app` or `postgres`)
- **POSTGRES_PASSWORD**: Your database password
- **POSTGRES_DB**: Your database name (e.g., `blich_studio`)
- **POSTGRES_PORT**: `5432`

---

## Step 5: VPC Connector Setup (2 minutes)

Check if you already have a VPC connector, or create one.

### 5.1 Check Existing VPC Connectors

```bash
# List existing connectors
gcloud compute networks vpc-access connectors list --region=$GCP_REGION
```

### 5.2 Use Existing or Create New

**Option A: Use Existing Connector**
```bash
# If you have one, set the name
export VPC_CONNECTOR_NAME="your-existing-connector"
```

**Option B: Create New Connector**
```bash
# Create VPC connector (takes 3-4 minutes)
export VPC_CONNECTOR_NAME="blich-vpc-connector"

gcloud compute networks vpc-access connectors create $VPC_CONNECTOR_NAME \
  --region=$GCP_REGION \
  --network=default \
  --range=10.8.0.0/28 \
  --min-instances=2 \
  --max-instances=3 \
  --machine-type=f1-micro
```

**Verify:**
```bash
gcloud compute networks vpc-access connectors describe $VPC_CONNECTOR_NAME \
  --region=$GCP_REGION

echo "VPC_CONNECTOR_NAME=$VPC_CONNECTOR_NAME" >> ~/gcp-credentials.txt
```

---

## Step 6: Run Database Migrations (5 minutes)

### 6.1 Download Cloud SQL Proxy

**For macOS:**
```bash
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.darwin.amd64
chmod +x cloud-sql-proxy
```

**For Linux:**
```bash
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.linux.amd64
chmod +x cloud-sql-proxy
```

### 6.2 Start Proxy

```bash
./cloud-sql-proxy $POSTGRES_CONNECTION_NAME &
```

You'll see: "Listening on 127.0.0.1:5432"

### 6.3 Run Migrations

```bash
# Set your database credentials
export POSTGRES_USER="blich_app"
export POSTGRES_DB="blich_studio"
export PGPASSWORD="your-database-password"

# Run migrations
psql -h localhost -U $POSTGRES_USER -d $POSTGRES_DB -f database/migrations/001_user_registration.sql
psql -h localhost -U $POSTGRES_USER -d $POSTGRES_DB -f database/migrations/002_add_token_prefix.sql

# Unset password
unset PGPASSWORD
```

**Verify migrations:**
```bash
export PGPASSWORD="your-database-password"
psql -h localhost -U $POSTGRES_USER -d $POSTGRES_DB -c "\dt"
unset PGPASSWORD
```

Expected output: `users` and `verification_tokens` tables.

### 6.4 Stop Proxy

```bash
pkill cloud-sql-proxy
```

---

## Step 7: Create Secrets in Secret Manager (3 minutes)

Store your existing database credentials and app config securely.

```bash
# Database connection (use your actual values)
echo -n "$POSTGRES_CONNECTION_NAME" | gcloud secrets create POSTGRES_HOST --data-file=-
echo -n "5432" | gcloud secrets create POSTGRES_PORT --data-file=-
echo -n "blich_app" | gcloud secrets create POSTGRES_USER --data-file=-  # Your DB username
echo -n "your-db-password" | gcloud secrets create POSTGRES_PASSWORD --data-file=-  # Your DB password
echo -n "blich_studio" | gcloud secrets create POSTGRES_DB --data-file=-  # Your DB name
echo -n "true" | gcloud secrets create POSTGRES_SSL --data-file=-

# Application config
echo -n "12" | gcloud secrets create BCRYPT_SALT_ROUNDS --data-file=-
echo -n "24" | gcloud secrets create VERIFICATION_TOKEN_EXPIRY_HOURS --data-file=-
```

### 7.1 Grant Access to Cloud Run and Cloud Build

```bash
# Grant Cloud Run access to secrets
gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Grant Cloud Build access to secrets (for build-time if needed)
gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

**Verify secrets:**
```bash
gcloud secrets list
```

You should see all 8 secrets listed.

---

## Step 8: Setup Cloud Build (2 minutes)

Instead of building locally, use Cloud Build for automated deployments.

### 8.1 Grant Cloud Build Permissions

```bash
# Grant Cloud Run Admin role to Cloud Build
gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/run.admin"

# Grant Service Account User role
gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

# Grant Artifact Registry Writer role
gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"
```

### 8.2 Update cloudbuild.yaml with Your Values

Edit `cloudbuild.yaml` to use your VPC connector:

```bash
# Check current VPC connector name in cloudbuild.yaml
grep "VPC_CONNECTOR" cloudbuild.yaml

# Should match: _VPC_CONNECTOR: 'your-vpc-connector-name'
```

The file already has the correct structure - just verify the `_VPC_CONNECTOR` substitution matches your connector name.

---

## Step 9: Deploy with Cloud Build (3 minutes)

### 9.1 First Deployment (Manual)

```bash
# Set your NPM token
export NPM_TOKEN="your-npm-token"

# Submit build to Cloud Build
gcloud builds submit \
  --config=cloudbuild.yaml \
  --substitutions=_NPM_TOKEN=$NPM_TOKEN,_VPC_CONNECTOR=$VPC_CONNECTOR_NAME,_IMAGE_TAG=latest

# This will:
# 1. Build Docker image in Cloud Build
# 2. Push to Artifact Registry
# 3. Deploy to Cloud Run with all secrets
# Takes 3-5 minutes
```

Watch the build progress in terminal or [Cloud Build Console](https://console.cloud.google.com/cloud-build/builds).

### 9.2 Get Service URL

```bash
export SERVICE_URL=$(gcloud run services describe blich-api-gateway \
  --region $GCP_REGION \
  --format 'value(status.url)')

echo "✅ Service deployed!"
echo "Service URL: $SERVICE_URL"
echo "SERVICE_URL=$SERVICE_URL" >> ~/gcp-credentials.txt
```

---

## Step 10: Test Deployment (2 minutes)

### 10.1 Health Check

```bash
curl $SERVICE_URL
```

Expected: `Hello World!` or your app's default response.

### 10.2 Test Registration Endpoint

```bash
curl -X POST $SERVICE_URL/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123!"
  }'
```

Expected: Success response with verification message.

### 10.3 Check Logs

```bash
gcloud run services logs read blich-api-gateway \
  --region $GCP_REGION \
  --limit 50
```

---

## Step 11: Setup Automated Deployments with Cloud Build (5 minutes)

### 11.1 Connect GitHub Repository

```bash
# Create GitHub connection (first time only)
gcloud builds connections create github "blich-studio-github" \
  --region=$GCP_REGION
```

This opens a browser window to authorize GitHub access.

### 11.2 Create Cloud Build Trigger

**First, link the repository:**

```bash
# Link the GitHub repository to Cloud Build
gcloud alpha builds repositories create api-gateway \
  --remote-uri=https://github.com/Blich-Studio/api-gateway.git \
  --connection=blich-studio-github \
  --region=$GCP_REGION
```

**Then create the trigger via Console (recommended for 2nd gen):**

The CLI has limitations with 2nd gen GitHub triggers. Use the Console for reliable setup:

1. **Open Cloud Build Triggers**: 
   ```bash
   open "https://console.cloud.google.com/cloud-build/triggers;region=$GCP_REGION?project=$GCP_PROJECT_ID"
   ```

2. **Create the trigger**:
   - Click **CREATE TRIGGER**
   - **Name**: `blich-api-gateway-deploy`
   - **Region**: `europe-west1`
   - **Event**: Push to a branch
   - **Source**: 2nd gen
   - **Repository**: Select `api-gateway` from dropdown
   - **Branch**: `^main$` (regex pattern)
   - **Configuration**: Cloud Build configuration file
   - **Location**: `cloudbuild.yaml`
   - **Substitution variables**: Click **ADD VARIABLE**
     - Variable: `_VPC_CONNECTOR`
     - Value: `blich-vpc-connector`
   - Click **CREATE**

**Note:** The `_NPM_TOKEN` is automatically loaded from Secret Manager (configured in cloudbuild.yaml) - no need to add it as a substitution variable.

### 11.3 Add NPM Token to Cloud Build (if using private packages)

```bash
# Store NPM token as Cloud Build secret
echo -n "your-npm-token" | gcloud secrets create NPM_TOKEN_CLOUDBUILD --data-file=-

# Grant Cloud Build access
gcloud secrets add-iam-policy-binding NPM_TOKEN_CLOUDBUILD \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

**Update cloudbuild.yaml** to use the secret:
```yaml
availableSecrets:
  secretManager:
  - versionName: projects/$PROJECT_ID/secrets/NPM_TOKEN_CLOUDBUILD/versions/latest
    env: 'NPM_TOKEN'
```

### 11.4 Test Automatic Deployment

```bash
# Push to main branch triggers automatic deployment
git push origin main
```

**Or manually trigger the build:**
```bash
# Submit a manual build (works immediately without trigger)
gcloud builds submit \
  --config=cloudbuild.yaml \
  --substitutions=_VPC_CONNECTOR=$VPC_CONNECTOR_NAME
```

**View build status:**
- Terminal: `gcloud builds list --limit=5`
- Console: https://console.cloud.google.com/cloud-build/builds

### 11.5 Setup Branch-Specific Deployments (Optional)

Create separate triggers for staging and production via the Console:

**Staging Trigger** (development branch):
- Name: `blich-api-gateway-staging`
- Branch: `^development$`
- Substitution variables:
  - `_VPC_CONNECTOR` = `blich-vpc-connector`
  - `_SERVICE_NAME` = `blich-api-gateway-staging`
  - `_MIN_INSTANCES` = `0`
  - `_MAX_INSTANCES` = `3`

**Production Trigger** (main branch):
- Name: `blich-api-gateway-production`
- Branch: `^main$`
- Substitution variables:
  - `_VPC_CONNECTOR` = `blich-vpc-connector`
  - `_SERVICE_NAME` = `blich-api-gateway`
  - `_MIN_INSTANCES` = `1`
  - `_MAX_INSTANCES` = `10`

---

## Step 12: Setup Custom Domain (Optional, 10 minutes)

### 12.1 Map Domain

```bash
gcloud run domain-mappings create \
  --service=blich-api-gateway \
  --domain=api.yourdomain.com \
  --region=$GCP_REGION
```

### 12.2 Add DNS Records

The command will output DNS records to add. Add these to your domain provider:

```
Type: CNAME
Name: api
Value: ghs.googlehosted.com
```

Wait 5-10 minutes for DNS propagation.

### 12.3 Verify

```bash
curl https://api.yourdomain.com
```

---

## Step 13: Setup Monitoring (5 minutes)

### 13.1 Create Uptime Check

```bash
gcloud monitoring uptime-checks create http blich-api-gateway-health \
  --display-name="API Gateway Health Check" \
  --resource-type=uptime-url \
  --monitored-resource-labels=host="$SERVICE_URL"
```

### 13.2 Setup Budget Alerts

1. Go to [GCP Console > Billing > Budgets](https://console.cloud.google.com/billing/budgets)
2. Click "Create Budget"
3. Set budget amount (e.g., $100/month)
4. Set alert thresholds (50%, 90%, 100%)
5. Add email for notifications

### 13.3 View Logs

**Cloud Console:**
- [Cloud Run Dashboard](https://console.cloud.google.com/run)
- [Logs Explorer](https://console.cloud.google.com/logs)

**CLI:**
```bash
# Stream logs
gcloud run services logs tail blich-api-gateway --region=$GCP_REGION --follow

# Recent logs
gcloud run services logs read blich-api-gateway --region=$GCP_REGION --limit=50
```

---

## Deployment Complete! 🎉

Your API Gateway is now running on GCP Cloud Run with Cloud Build automated deployments.

### What You've Accomplished

✅ Connected to existing Cloud SQL instance
✅ Set up VPC connector for private database access
✅ Created secrets in Secret Manager
✅ Ran database migrations
✅ Deployed to Cloud Run via Cloud Build
✅ Set up automatic deployments on git push

### Quick Reference Commands

**View Service Status:**
```bash
gcloud run services describe blich-api-gateway --region=$GCP_REGION
echo "Service URL: $SERVICE_URL"
```

**Deploy New Version (Automatic):**
```bash
# Just push to main branch
git push origin main

# Cloud Build automatically:
# 1. Builds Docker image
# 2. Pushes to Artifact Registry
# 3. Deploys to Cloud Run
```

**Deploy New Version (Manual):**
```bash
gcloud builds submit \
  --config=cloudbuild.yaml \
  --substitutions=_NPM_TOKEN=$NPM_TOKEN,_VPC_CONNECTOR=$VPC_CONNECTOR_NAME
```

**View Build History:**
```bash
gcloud builds list --limit=10
```

**View Logs:**
```bash
# Stream logs
gcloud run services logs tail blich-api-gateway --region=$GCP_REGION --follow

# Recent logs
gcloud run services logs read blich-api-gateway --region=$GCP_REGION --limit=50
```

**Rollback to Previous Version:**
```bash
# List revisions
gcloud run revisions list --service=blich-api-gateway --region=$GCP_REGION

# Rollback
gcloud run services update-traffic blich-api-gateway \
  --to-revisions=REVISION_NAME=100 \
  --region=$GCP_REGION
```

---

## Deployment Architecture

```
GitHub Push → Cloud Build Trigger
                    ↓
              Build Docker Image
                    ↓
           Push to Artifact Registry
                    ↓
           Deploy to Cloud Run
                    ↓
              VPC Connector
                    ↓
         Existing Cloud SQL ✅
```

### Key Benefits of This Setup

1. **No Local Docker Builds** - Everything builds in GCP
2. **Native IAM** - No service account keys to manage
3. **Automatic Deployments** - Push to git = deploy to cloud
4. **Direct SQL Access** - VPC connector to your existing database
5. **Fast Builds** - No image transfers between clouds
6. **Rollback Support** - Easy to revert to previous versions

---

## Important Notes

### Security
- ✅ All secrets in Secret Manager (not in code)
- ✅ Database has no public IP (VPC-only access)
- ✅ Cloud Run uses HTTPS by default
- ✅ Service runs as non-root user
- ✅ Cloud Build uses native IAM (no keys)
- ⚠️ Email provider not configured (logs to console)

### Costs (Approximate)
- **Cloud Run**: $5-50/month (scales to zero when idle)
- **Cloud Build**: First 120 build-minutes/day free, then ~$0.003/min
- **VPC Connector**: $7/month (if newly created)
- **Cloud SQL**: Already running (existing cost)
- **Artifact Registry**: $0.10/GB/month storage
- **Total Additional**: ~$12-57/month (excluding existing SQL costs)

### Credentials File
All credentials saved to: `~/gcp-credentials.txt`

**⚠️ Keep this file secure and delete after noting credentials in password manager!**

---

## Troubleshooting

### Service won't start
```bash
# Check logs
gcloud run services logs read blich-api-gateway --region=$GCP_REGION --limit=100

# Check service status
gcloud run services describe blich-api-gateway --region=$GCP_REGION
```

### Database connection failed
```bash
# Check VPC connector
gcloud compute networks vpc-access connectors describe blich-vpc-connector --region=$GCP_REGION

# Test Cloud SQL
gcloud sql connect blich-postgres-prod --user=blich_app --database=blich_studio
```

### Secrets not accessible
```bash
# Check IAM permissions
gcloud projects get-iam-policy $GCP_PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:*compute@developer.gserviceaccount.com"
```

### Build failed
```bash
# View build logs
gcloud builds list --limit=5
gcloud builds log BUILD_ID
```

---

## Next Steps

1. **Configure Email Provider**: Implement SendGrid/AWS SES in `src/modules/email/email.service.ts`
2. **Setup Monitoring**: Configure alerts and dashboards
3. **Enable Backups**: Cloud SQL automatic backups are enabled
4. **Custom Domain**: Map your domain to Cloud Run service
5. **CI/CD**: Push to GitHub to trigger automatic deployments

---

## Development Workflow

After initial deployment, your workflow is simple:

```bash
# 1. Make code changes locally
# 2. Test locally with Docker
docker-compose -f docker-compose.dev.yml up

# 3. Commit and push
git add .
git commit -m "feat: add new feature"
git push origin main

# 4. Cloud Build automatically deploys (takes 3-5 minutes)
# 5. Check deployment
gcloud builds list --limit=1
gcloud run services logs read blich-api-gateway --region=$GCP_REGION --limit=20
```

**That's it!** No manual Docker builds, no image pushing, no deployment commands.

---

## Troubleshooting

### Cloud Build Fails

```bash
# View build logs
gcloud builds list --limit=5
gcloud builds log <BUILD_ID>

# Common issues:
# - NPM token not set: Add to secrets or substitution
# - VPC connector wrong: Update _VPC_CONNECTOR in trigger
# - Permissions missing: Re-run Step 8 to grant permissions
```

### Service Won't Start

```bash
# Check Cloud Run logs
gcloud run services logs read blich-api-gateway --region=$GCP_REGION --limit=100

# Check service status
gcloud run services describe blich-api-gateway --region=$GCP_REGION

# Common issues:
# - Database connection failed: Check VPC connector
# - Secrets not accessible: Re-run Step 7.1
# - Port mismatch: Should be 3000 in Dockerfile and cloudbuild.yaml
```

### Database Connection Issues

```bash
# Test VPC connector
gcloud compute networks vpc-access connectors describe $VPC_CONNECTOR_NAME \
  --region=$GCP_REGION

# Check Cloud SQL status
gcloud sql instances describe $SQL_INSTANCE_NAME

# Verify secrets
gcloud secrets versions access latest --secret=POSTGRES_HOST
gcloud secrets versions access latest --secret=POSTGRES_USER

# Test connection from Cloud Shell
gcloud sql connect $SQL_INSTANCE_NAME --user=postgres
```

### Build Trigger Not Running

```bash
# List triggers
gcloud builds triggers list --region=$GCP_REGION

# Check trigger config
gcloud builds triggers describe blich-api-gateway-deploy --region=$GCP_REGION

# Manual trigger test
gcloud builds triggers run blich-api-gateway-deploy --branch=main --region=$GCP_REGION
```

---

## Next Steps

1. ✅ **Test the API** - Try the registration endpoint
2. ✅ **Configure Email Provider** - Implement SendGrid/AWS SES in `src/modules/email/email.service.ts`
3. ✅ **Setup Monitoring** - Add uptime checks and alerts (Step 13)
4. ✅ **Custom Domain** - Map your domain (Step 12)
5. ✅ **Staging Environment** - Create separate triggers for dev/staging/prod
6. ✅ **Database Backups** - Verify Cloud SQL backup schedule
7. ✅ **Load Testing** - Test with expected traffic load

---

**Total Deployment Time: ~20-30 minutes** (using existing Cloud SQL)

**Questions?** Check the [README.md](README.md) or [Cloud Build docs](https://cloud.google.com/build/docs).
