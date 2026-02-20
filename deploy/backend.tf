terraform {
  backend "gcs" {
    bucket = "blichstudio-infras-terraform-state"
    prefix = "terraform/state/api-gateway"
  }
}
