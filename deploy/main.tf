# API Gateway - Cloud Run Deployment
# Reads shared infra outputs via remote state

# Import existing Cloud Run service (remove after first successful apply)
import {
  to = module.api_gateway.google_cloud_run_v2_service.main
  id = "projects/blichstudio-infras/locations/europe-west1/services/blich-api-gateway"
}

provider "google" {
  project = data.terraform_remote_state.shared.outputs.project_id
  region  = data.terraform_remote_state.shared.outputs.region
}

data "terraform_remote_state" "shared" {
  backend = "gcs"
  config = {
    bucket = "blichstudio-infras-terraform-state"
    prefix = "terraform/state/shared"
  }
}

module "api_gateway" {
  source = "../../terraform-modules/modules/cloud-run"

  service_name    = "blich-api-gateway"
  environment     = data.terraform_remote_state.shared.outputs.environment
  region          = data.terraform_remote_state.shared.outputs.region
  project_id      = data.terraform_remote_state.shared.outputs.project_id
  container_image = var.container_image
  port            = 3000

  cpu_limit    = "1"
  memory_limit = "512Mi"

  min_instances = 0
  max_instances = 10

  cpu_idle          = true
  startup_cpu_boost = false
  request_timeout   = 300

  # Direct VPC Egress for Cloud SQL access
  enable_vpc_access = true
  vpc_network       = data.terraform_remote_state.shared.outputs.vpc_name
  vpc_subnetwork    = data.terraform_remote_state.shared.outputs.subnet_name

  service_account_email = data.terraform_remote_state.shared.outputs.service_account_emails["api-gateway"]
  allow_public_access   = true

  environment_variables = {
    NODE_ENV            = "production"
    APP_URL             = "https://api.blichstudio.com"
    JWKS_URL            = "https://jwks.blichstudio.com/.well-known/jwks.json"
    JWKS_TOKEN_ENDPOINT = "https://jwks.blichstudio.com/token"
    JWT_ISSUER          = "https://jwks.blichstudio.com"
    JWT_AUDIENCE        = "blich-api"
    ALLOWED_ORIGINS     = "https://blichstudio.com,https://www.blichstudio.com,https://admin.blichstudio.com"
    GCP_PROJECT_ID      = data.terraform_remote_state.shared.outputs.project_id
    POSTGRES_SSL        = "false"
  }

  secret_environment_variables = {
    POSTGRES_HOST      = { secret_name = "postgres-host", version = "latest" }
    POSTGRES_PORT      = { secret_name = "postgres-port", version = "latest" }
    POSTGRES_USER      = { secret_name = "postgres-user", version = "latest" }
    POSTGRES_PASSWORD  = { secret_name = "postgres-password", version = "latest" }
    POSTGRES_DB        = { secret_name = "postgres-db", version = "latest" }
    JWKS_TOKEN_API_KEY = { secret_name = "jwks-token-api-key", version = "latest" }
    SENDGRID_API_KEY   = { secret_name = "sendgrid-api-key", version = "latest" }
    EMAIL_FROM         = { secret_name = "email-from", version = "latest" }
    GCS_BUCKET_NAME    = { secret_name = "gcs-bucket-name", version = "latest" }
    BCRYPT_SALT_ROUNDS = { secret_name = "bcrypt-salt-rounds", version = "latest" }
  }

  labels = { service = "api-gateway" }
}
