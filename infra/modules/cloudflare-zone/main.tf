terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "5.23.0"
    }
  }
}

resource "cloudflare_zone" "this" {
  account = { id = var.account_id }
  name    = var.zone_name

  # A full zone means Cloudflare hosts the DNS, which is what changing the
  # nameservers at the registrar sets up.
  type = "full"
}

# Signs the zone so a resolver can prove an answer was not tampered with.
# The matching DS record must be entered at the registrar AFTER this is active;
# doing it in the other order makes the domain fail to resolve.
resource "cloudflare_zone_dnssec" "this" {
  zone_id = cloudflare_zone.this.id
  status  = "active"
}

# Names the only certificate authorities allowed to issue for this zone.
# Cloudflare adds its own CAA records alongside these once any CAA record
# exists, but that is a safety net, not a reason to keep the list stale.
resource "cloudflare_dns_record" "caa_issue" {
  for_each = var.caa_issuers

  zone_id = cloudflare_zone.this.id
  name    = var.zone_name
  type    = "CAA"
  ttl     = 3600
  comment = "Restrict which CAs may issue certificates for this zone"

  data = {
    flags = 0
    tag   = "issue"
    value = each.value
  }
}

resource "cloudflare_zone_setting" "ssl" {
  zone_id    = cloudflare_zone.this.id
  setting_id = "ssl"
  value      = "strict"
}

resource "cloudflare_zone_setting" "always_use_https" {
  zone_id    = cloudflare_zone.this.id
  setting_id = "always_use_https"
  value      = "on"
}

resource "cloudflare_zone_setting" "automatic_https_rewrites" {
  zone_id    = cloudflare_zone.this.id
  setting_id = "automatic_https_rewrites"
  value      = "on"
}

resource "cloudflare_zone_setting" "min_tls_version" {
  zone_id    = cloudflare_zone.this.id
  setting_id = "min_tls_version"
  value      = "1.2"
}

resource "cloudflare_zone_setting" "tls_1_3" {
  zone_id    = cloudflare_zone.this.id
  setting_id = "tls_1_3"
  value      = "on"
}

# Sent as a real response header by the edge. A year of max-age with
# includeSubDomains, but preload stays off: preload is submitted to a browser
# list that is very hard to leave, so it waits until the zone has run stably.
resource "cloudflare_zone_setting" "security_header" {
  zone_id    = cloudflare_zone.this.id
  setting_id = "security_header"

  value = {
    strict_transport_security = {
      enabled            = true
      include_subdomains = true
      max_age            = 31536000
      nosniff            = true
      preload            = false
    }
  }
}

resource "cloudflare_zone_setting" "brotli" {
  zone_id    = cloudflare_zone.this.id
  setting_id = "brotli"
  value      = "on"
}

# Bot Fight Mode. The v5 provider does expose this, through the bot management
# resource rather than a zone setting, so it belongs in code rather than in the
# dashboard. Only fight_mode is set: the Super Bot Fight Mode fields next to it
# need a paid plan and this zone is on Free.
resource "cloudflare_bot_management" "this" {
  zone_id    = cloudflare_zone.this.id
  fight_mode = var.bot_fight_mode
}
