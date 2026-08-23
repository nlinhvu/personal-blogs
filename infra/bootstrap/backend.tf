# Rename this file to backend.tf after the first apply has created the bucket,
# then run: tofu init -migrate-state
terraform {
  backend "s3" {
    bucket = "vulinh-tofu-state"
    key    = "bootstrap/terraform.tfstate"
    region = "auto"

    endpoints = { s3 = "https://7a78eec29b31ad25b2a9f749a3cc2078.r2.cloudflarestorage.com" }

    # State locking through S3 conditional writes (If-None-Match).
    use_lockfile = true

    # Standard configuration for any non-AWS S3-compatible endpoint, not a
    # workaround: R2 has no AWS account, no regions and no STS metadata API,
    # and it rejects the extra checksum trailer the AWS SDK sends by default.
    use_path_style              = true
    skip_credentials_validation = true
    skip_region_validation      = true
    skip_metadata_api_check     = true
    skip_requesting_account_id  = true
    skip_s3_checksum            = true
  }
}
