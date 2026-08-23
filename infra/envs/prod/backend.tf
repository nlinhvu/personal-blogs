terraform {
  required_version = "~> 1.12.0"
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "5.23.0"
    }
  }

  # Same bucket as every other environment; the key is what separates them.
  backend "s3" {
    bucket = "vulinh-tofu-state"
    key    = "prod/terraform.tfstate"
    region = "auto"

    endpoints = { s3 = "https://7a78eec29b31ad25b2a9f749a3cc2078.r2.cloudflarestorage.com" }

    # Verified against R2 on 2026-08-23; see infra/README.md.
    use_lockfile = true

    # Standard configuration for any non-AWS S3-compatible endpoint.
    use_path_style              = true
    skip_credentials_validation = true
    skip_region_validation      = true
    skip_metadata_api_check     = true
    skip_requesting_account_id  = true
    skip_s3_checksum            = true
  }
}
