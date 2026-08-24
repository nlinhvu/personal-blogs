# Credentials come from the environment: CLOUDFLARE_API_TOKEN.
provider "cloudflare" {}

module "zone" {
  source     = "../../modules/cloudflare-zone"
  account_id = var.cloudflare_account_id
  zone_name  = var.zone_name
}

# The Web Analytics site was created through the dashboard on 2026-08-23,
# before it was declared here. Without this block the next apply would create a
# SECOND site for the same zone rather than adopt the existing one, and the
# beacon token on the live pages would change.
#
# Remove this block once the import has been applied and `tofu plan` is clean;
# leaving it in place is harmless but it is one-time scaffolding, not config.
import {
  to = module.zone.cloudflare_web_analytics_site.this
  id = "${var.cloudflare_account_id}/f8ac189482814a0db07afdfef165057d"
}

module "worker_domain" {
  source     = "../../modules/worker-domain"
  account_id = var.cloudflare_account_id
  zone_id    = module.zone.zone_id
  zone_name  = module.zone.zone_name
  hostname   = var.zone_name # apex
  service    = var.worker_name
}

output "name_servers" {
  description = "Set these at the registrar to hand DNS over to Cloudflare"
  value       = module.zone.name_servers
}

output "dnssec_ds" {
  value = module.zone.dnssec_ds
}

output "dnssec_details" {
  value = module.zone.dnssec_details
}
