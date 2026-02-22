output "service_url" {
  description = "API Gateway Cloud Run service URL"
  value       = module.api_gateway.service_uri
}

output "latest_revision" {
  description = "Latest deployed revision"
  value       = module.api_gateway.latest_revision
}
