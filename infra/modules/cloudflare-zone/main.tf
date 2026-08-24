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

# Bot Fight Mode, declared so a dashboard click shows up as drift on the next
# plan. It is off; see ADR-0009 for the reasoning. In short: Cloudflare forces
# JavaScript Detections on alongside it, JavaScript Detections injects an inline
# script, and this zone delivers its CSP through a <meta> tag, which Cloudflare
# cannot add a nonce to. The injected script would be blocked on every page view
# and the console error would be the only thing anyone gained.
resource "cloudflare_bot_management" "this" {
  zone_id    = cloudflare_zone.this.id
  fight_mode = var.bot_fight_mode
}

# Cloudflare Web Analytics. `auto_install` is the part that matters: it makes
# the edge inject the beacon script into HTML responses, and it does that only
# for browser-shaped requests. curl never sees the script, so neither CI nor the
# test suite can catch a problem with it — the only place it shows up is a real
# reader's console. That asymmetry is exactly why it belongs in state: a
# dashboard click here is invisible to every other check the project has.
#
# The site already existed when this was written, created 2026-08-23, and was
# imported rather than created. See infra/README.md.
#
# The values below are the ones the live site already carries, and they are
# meant to stay that way. Cloudflare exposes Account Analytics at Read only, so
# this token can import the site and detect drift on it but cannot write it: a
# plan that proposes a CHANGE here will fail at apply with 403. That makes this
# resource a tripwire rather than a control. Reconcile a diff in the dashboard
# and bring the config back in line, do not try to apply through it.
#
# Allowing the beacon costs two CSP directives in site/astro.config.mjs:
# `script-src` for static.cloudflareinsights.com and `connect-src` for
# cloudflareinsights.com, which is where the beacon POSTs its sample. Turning
# this off does not require removing those, but leaving them without this is
# dead configuration.
resource "cloudflare_web_analytics_site" "this" {
  account_id   = var.account_id
  zone_tag     = cloudflare_zone.this.id
  auto_install = var.web_analytics
  enabled      = var.web_analytics

  # Cloudflare's own term for the free tier of Web Analytics. Reflects what the
  # existing site was created with; declaring it keeps plan quiet.
  lite = true
}
