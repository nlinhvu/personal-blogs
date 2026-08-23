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
    Bot Fight Mode challenges requests matching known bot patterns. It is free
    on every plan, but it cannot be customised and cannot be skipped by a WAF
    custom rule, so it may also challenge legitimate automation such as the
    curl-based smoke tests in .github/workflows.
  EOT
  type        = bool
  default     = true
}
