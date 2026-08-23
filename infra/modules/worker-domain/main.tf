terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "5.23.0"
    }
  }
}

# The Worker script itself is deployed by wrangler and is deliberately not
# managed here. This resource only binds an existing Worker to a hostname.
#
# The Worker must already exist when this is applied: the binding points at a
# script by name, and Cloudflare rejects a name it cannot find.
resource "cloudflare_workers_custom_domain" "this" {
  account_id = var.account_id
  hostname   = var.hostname
  service    = var.service
  zone_id    = var.zone_id
  zone_name  = var.zone_name
}
