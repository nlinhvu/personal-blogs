variable "cloudflare_account_id" {
  description = "Cloudflare account ID for the prod account"
  type        = string
}

variable "state_bucket_name" {
  description = "R2 bucket that stores OpenTofu remote state"
  type        = string
  default     = "vulinh-tofu-state"
}
