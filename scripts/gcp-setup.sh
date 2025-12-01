#!/bin/bash

# GCP Setup Script
# This script sets up all required GCP resources for the Blich API Gateway
# Run with: ./scripts/gcp-setup.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
GCP_PROJECT_ID="${GCP_PROJECT_ID:-}"
GCP_REGION="${GCP_REGION:-europe-west1}"
SERVICE_NAME="blich-api-gateway"
ARTIFACT_REGISTRY_REPO="blich-studio"
SQL_INSTANCE_PROD="blich-postgres-prod"
SQL_INSTANCE_STAGING="blich-postgres-staging"
VPC_CONNECTOR="blich-vpc-connector"
DB_NAME="blich_studio"
DB_USER="blich_app"

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."
    
    if ! command_exists gcloud; then
        print_error "gcloud CLI is not installed. Please install it first."
        exit 1
    fi
    
    if [ -z "$GCP_PROJECT_ID" ]; then
        print_error "GCP_PROJECT_ID is not set. Please set it using: export GCP_PROJECT_ID='your-project-id'"
        exit 1
    fi
    
    print_info "Prerequisites check passed ✓"
}

# Set GCP project
set_project() {
    print_info "Setting GCP project to $GCP_PROJECT_ID..."
    gcloud config set project "$GCP_PROJECT_ID"
    gcloud config set run/region "$GCP_REGION"
    print_info "Project configuration set ✓"
}

# Enable required APIs
enable_apis() {
    print_info "Enabling required APIs..."
    gcloud services enable \
        run.googleapis.com \
        cloudbuild.googleapis.com \
        artifactregistry.googleapis.com \
        sqladmin.googleapis.com \
        vpcaccess.googleapis.com \
        secretmanager.googleapis.com \
        cloudresourcemanager.googleapis.com \
        compute.googleapis.com
    print_info "APIs enabled ✓"
}

# Create Artifact Registry
create_artifact_registry() {
    print_info "Creating Artifact Registry repository..."
    
    if gcloud artifacts repositories describe "$ARTIFACT_REGISTRY_REPO" --location="$GCP_REGION" >/dev/null 2>&1; then
        print_warning "Artifact Registry repository already exists, skipping..."
    else
        gcloud artifacts repositories create "$ARTIFACT_REGISTRY_REPO" \
            --repository-format=docker \
            --location="$GCP_REGION" \
            --description="Blich Studio Docker images"
        print_info "Artifact Registry created ✓"
    fi
    
    # Configure Docker authentication
    gcloud auth configure-docker "$GCP_REGION-docker.pkg.dev"
}

# Create VPC Connector
create_vpc_connector() {
    print_info "Creating VPC connector..."
    
    if gcloud compute networks vpc-access connectors describe "$VPC_CONNECTOR" --region="$GCP_REGION" >/dev/null 2>&1; then
        print_warning "VPC connector already exists, skipping..."
    else
        gcloud compute networks vpc-access connectors create "$VPC_CONNECTOR" \
            --region="$GCP_REGION" \
            --network=default \
            --range=10.8.0.0/28 \
            --min-instances=2 \
            --max-instances=3 \
            --machine-type=f1-micro
        print_info "VPC connector created ✓"
    fi
}

# Create Cloud SQL instances
create_cloud_sql() {
    local instance_name=$1
    local tier=$2
    
    print_info "Creating Cloud SQL instance: $instance_name..."
    
    if gcloud sql instances describe "$instance_name" >/dev/null 2>&1; then
        print_warning "Cloud SQL instance $instance_name already exists, skipping..."
        return
    fi
    
    if [ "$instance_name" = "$SQL_INSTANCE_PROD" ]; then
        gcloud sql instances create "$instance_name" \
            --database-version=POSTGRES_16 \
            --tier="$tier" \
            --region="$GCP_REGION" \
            --network=default \
            --no-assign-ip \
            --enable-bin-log \
            --backup-start-time=03:00 \
            --maintenance-window-day=SUN \
            --maintenance-window-hour=04
    else
        gcloud sql instances create "$instance_name" \
            --database-version=POSTGRES_16 \
            --tier="$tier" \
            --region="$GCP_REGION" \
            --network=default \
            --no-assign-ip
    fi
    
    print_info "Cloud SQL instance $instance_name created ✓"
}

# Setup database
setup_database() {
    local instance_name=$1
    
    print_info "Setting up database on $instance_name..."
    
    # Generate secure passwords
    local root_password=$(openssl rand -base64 32)
    local app_password=$(openssl rand -base64 32)
    
    # Set root password
    gcloud sql users set-password postgres \
        --instance="$instance_name" \
        --password="$root_password"
    
    # Create application user
    if ! gcloud sql users describe "$DB_USER" --instance="$instance_name" >/dev/null 2>&1; then
        gcloud sql users create "$DB_USER" \
            --instance="$instance_name" \
            --password="$app_password"
    else
        print_warning "User $DB_USER already exists, skipping user creation..."
    fi
    
    # Create database
    if ! gcloud sql databases describe "$DB_NAME" --instance="$instance_name" >/dev/null 2>&1; then
        gcloud sql databases create "$DB_NAME" \
            --instance="$instance_name"
    else
        print_warning "Database $DB_NAME already exists, skipping database creation..."
    fi
    
    # Get connection name
    local connection_name=$(gcloud sql instances describe "$instance_name" --format='value(connectionName)')
    
    print_info "Database setup complete ✓"
    print_info "Connection name: $connection_name"
    print_warning "IMPORTANT: Save these credentials securely!"
    echo "Root password: $root_password"
    echo "App user: $DB_USER"
    echo "App password: $app_password"
    echo ""
}

# Create secrets
create_secrets() {
    local instance_name=$1
    local postgres_host=$2
    local postgres_password=$3
    
    print_info "Creating secrets in Secret Manager..."
    
    # Helper function to create or update secret
    create_or_update_secret() {
        local secret_name=$1
        local secret_value=$2
        
        if gcloud secrets describe "$secret_name" >/dev/null 2>&1; then
            echo -n "$secret_value" | gcloud secrets versions add "$secret_name" --data-file=-
            print_info "Secret $secret_name updated"
        else
            echo -n "$secret_value" | gcloud secrets create "$secret_name" --data-file=-
            print_info "Secret $secret_name created"
        fi
    }
    
    create_or_update_secret "POSTGRES_HOST" "$postgres_host"
    create_or_update_secret "POSTGRES_PORT" "5432"
    create_or_update_secret "POSTGRES_USER" "$DB_USER"
    create_or_update_secret "POSTGRES_PASSWORD" "$postgres_password"
    create_or_update_secret "POSTGRES_DB" "$DB_NAME"
    create_or_update_secret "POSTGRES_SSL" "true"
    create_or_update_secret "BCRYPT_SALT_ROUNDS" "12"
    create_or_update_secret "VERIFICATION_TOKEN_EXPIRY_HOURS" "24"
    
    # Grant Cloud Run access to secrets
    local project_number=$(gcloud projects describe "$GCP_PROJECT_ID" --format='value(projectNumber)')
    gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
        --member="serviceAccount:${project_number}-compute@developer.gserviceaccount.com" \
        --role="roles/secretmanager.secretAccessor" \
        --condition=None
    
    print_info "Secrets created and permissions granted ✓"
}

# Setup GitHub Actions
setup_github_actions() {
    print_info "Setting up GitHub Actions Workload Identity..."
    
    local sa_email="github-actions@${GCP_PROJECT_ID}.iam.gserviceaccount.com"
    local project_number=$(gcloud projects describe "$GCP_PROJECT_ID" --format='value(projectNumber)')
    
    # Create service account
    if ! gcloud iam service-accounts describe "$sa_email" >/dev/null 2>&1; then
        gcloud iam service-accounts create github-actions \
            --display-name="GitHub Actions Service Account"
        print_info "Service account created"
    else
        print_warning "Service account already exists, skipping..."
    fi
    
    # Grant roles
    gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
        --member="serviceAccount:$sa_email" \
        --role="roles/run.admin" \
        --condition=None
    
    gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
        --member="serviceAccount:$sa_email" \
        --role="roles/iam.serviceAccountUser" \
        --condition=None
    
    gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
        --member="serviceAccount:$sa_email" \
        --role="roles/artifactregistry.writer" \
        --condition=None
    
    # Create Workload Identity Pool
    if ! gcloud iam workload-identity-pools describe "github-pool" --location="global" >/dev/null 2>&1; then
        gcloud iam workload-identity-pools create "github-pool" \
            --location="global" \
            --display-name="GitHub Actions Pool"
        print_info "Workload Identity Pool created"
    else
        print_warning "Workload Identity Pool already exists, skipping..."
    fi
    
    # Create Provider
    if ! gcloud iam workload-identity-pools providers describe "github-provider" \
        --workload-identity-pool="github-pool" \
        --location="global" >/dev/null 2>&1; then
        gcloud iam workload-identity-pools providers create-oidc "github-provider" \
            --location="global" \
            --workload-identity-pool="github-pool" \
            --display-name="GitHub Provider" \
            --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" \
            --attribute-condition="assertion.repository_owner=='Blich-Studio'" \
            --issuer-uri="https://token.actions.githubusercontent.com"
        print_info "Workload Identity Provider created"
    else
        print_warning "Workload Identity Provider already exists, skipping..."
    fi
    
    # Bind service account
    gcloud iam service-accounts add-iam-policy-binding "$sa_email" \
        --role="roles/iam.workloadIdentityUser" \
        --member="principalSet://iam.googleapis.com/projects/${project_number}/locations/global/workloadIdentityPools/github-pool/attribute.repository/Blich-Studio/shared"
    
    # Get provider name
    local provider_name=$(gcloud iam workload-identity-pools providers describe "github-provider" \
        --workload-identity-pool="github-pool" \
        --location="global" \
        --format="value(name)")
    
    print_info "GitHub Actions setup complete ✓"
    print_info ""
    print_info "Add these secrets to your GitHub repository:"
    echo "GCP_PROJECT_ID: $GCP_PROJECT_ID"
    echo "GCP_SERVICE_ACCOUNT: $sa_email"
    echo "GCP_WORKLOAD_IDENTITY_PROVIDER: $provider_name"
    echo ""
}

# Main setup flow
main() {
    print_info "Starting GCP setup for Blich API Gateway..."
    echo ""
    
    # Check prerequisites
    check_prerequisites
    
    # Set project
    set_project
    
    # Enable APIs
    enable_apis
    
    # Create Artifact Registry
    create_artifact_registry
    
    # Create VPC Connector
    create_vpc_connector
    
    # Create Cloud SQL instances
    read -p "Create staging Cloud SQL instance? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        create_cloud_sql "$SQL_INSTANCE_STAGING" "db-f1-micro"
        setup_database "$SQL_INSTANCE_STAGING"
        local staging_connection=$(gcloud sql instances describe "$SQL_INSTANCE_STAGING" --format='value(connectionName)')
        read -p "Enter app password for staging: " staging_password
        create_secrets "$SQL_INSTANCE_STAGING" "$staging_connection" "$staging_password"
    fi
    
    read -p "Create production Cloud SQL instance? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        create_cloud_sql "$SQL_INSTANCE_PROD" "db-f1-micro"
        setup_database "$SQL_INSTANCE_PROD"
        local prod_connection=$(gcloud sql instances describe "$SQL_INSTANCE_PROD" --format='value(connectionName)')
        read -p "Enter app password for production: " prod_password
        create_secrets "$SQL_INSTANCE_PROD" "$prod_connection" "$prod_password"
    fi
    
    # Setup GitHub Actions
    read -p "Setup GitHub Actions Workload Identity? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        setup_github_actions
    fi
    
    print_info ""
    print_info "=========================================="
    print_info "GCP Setup Complete! ✓"
    print_info "=========================================="
    print_info ""
    print_info "Next steps:"
    echo "1. Save all passwords securely"
    echo "2. Run database migrations (see GCP_DEPLOYMENT.md)"
    echo "3. Add GitHub secrets (if using GitHub Actions)"
    echo "4. Deploy using: gcloud builds submit --config=cloudbuild.yaml"
    echo ""
}

# Run main function
main

