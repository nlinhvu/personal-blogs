# Credentials come from the environment: CLOUDFLARE_API_TOKEN.
provider "cloudflare" {}

module "zone" {
  source     = "../../modules/cloudflare-zone"
  account_id = var.cloudflare_account_id
  zone_name  = var.zone_name
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
