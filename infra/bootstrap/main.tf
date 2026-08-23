terraform {
  required_version = "~> 1.12.0"
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "5.23.0"
    }
  }
  # The backend block lives in backend.tf, which does not exist during the
  # first apply: the bucket that holds the state is what this module creates.
  # Activate it afterwards by renaming backend.tf.disabled to backend.tf.
}

# Credentials come from the environment: CLOUDFLARE_API_TOKEN.
provider "cloudflare" {}

resource "cloudflare_r2_bucket" "state" {
  account_id = var.cloudflare_account_id
  name       = var.state_bucket_name

  # Best effort, and only honored when the bucket is first created.
  location = "apac"

  lifecycle {
    prevent_destroy = true
  }
}

output "state_bucket_name" {
  value       = cloudflare_r2_bucket.state.name
  description = "Name of the R2 bucket holding OpenTofu remote state"
}

output "state_backend_endpoint" {
  value       = "https://${var.cloudflare_account_id}.r2.cloudflarestorage.com"
  description = "S3-compatible endpoint to configure as the backend in every environment"
}
