variable "account_id" {
  description = "Cloudflare account ID that owns the zone"
  type        = string
}

variable "zone_name" {
  description = "Apex domain name, e.g. vulinh.dev"
  type        = string
}

variable "caa_issuers" {
  description = <<-EOT
    Certificate authorities allowed to issue for this zone, keyed by a short
    name that only shapes the resource address.

    Read the current list from Cloudflare's documentation at apply time:
    https://developers.cloudflare.com/ssl/reference/certificate-authorities/

    A stale list does not fail loudly. It fails months later, when renewal is
    refused and the certificate simply expires. Verified 2026-08-23, when the
    live certificate for vulinh.dev was issued by Google Trust Services.
  EOT
  type        = map(string)
  default = {
    letsencrypt = "letsencrypt.org"
    google      = "pki.goog; cansignhttpexchanges=yes"
    sslcom      = "ssl.com"
    sectigo     = "sectigo.com"
  }
}

variable "bot_fight_mode" {
  description = <<-EOT
    Bot Fight Mode challenges requests matching known bot patterns.

    Off by default, and that is a decision rather than an oversight. Enabling it
    forces JavaScript Detections on, which injects an inline script into every
    HTML response. This zone delivers its Content-Security-Policy through a
    <meta> tag, and Cloudflare only adds a nonce to injected scripts when it can
    parse a CSP response header, so the injected script would be blocked on
    every page view. The signal it gathers is also unusable without an
    Enterprise Bot Management subscription. See ADR-0009.

    A static blog with no login, no forms and no write path has nothing here
    worth that cost. When an endpoint does appear, protect that endpoint with
    Turnstile instead of the whole zone with this.
  EOT
  type        = bool
  default     = false
}
