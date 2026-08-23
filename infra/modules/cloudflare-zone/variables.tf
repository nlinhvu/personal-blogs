variable "account_id" {
  description = "Cloudflare account ID that owns the zone"
  type        = string
}

variable "zone_name" {
  description = "Apex domain name, e.g. vulinh.dev"
  type        = string
}
