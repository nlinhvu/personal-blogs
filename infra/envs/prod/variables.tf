variable "cloudflare_account_id" {
  description = "Cloudflare account ID for the prod account"
  type        = string
}

variable "zone_name" {
  description = "Apex domain served by this environment"
  type        = string
  default     = "vulinh.dev"
}

variable "worker_name" {
  description = "Worker script bound to the apex, deployed by wrangler"
  type        = string
  default     = "blog-prod"
}
