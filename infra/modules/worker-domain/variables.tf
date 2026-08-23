variable "account_id" {
  description = "Cloudflare account ID that owns both the zone and the Worker"
  type        = string
}

variable "zone_id" {
  description = "Zone the hostname belongs to"
  type        = string
}

variable "zone_name" {
  description = "Apex domain name of that zone"
  type        = string
}

variable "hostname" {
  description = "Hostname to bind, e.g. vulinh.dev for the apex"
  type        = string
}

variable "service" {
  description = "Name of the Worker script, deployed by wrangler, not by OpenTofu"
  type        = string
}
