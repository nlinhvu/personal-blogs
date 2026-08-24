output "zone_id" {
  description = "Zone identifier, consumed by the worker-domain module"
  value       = cloudflare_zone.this.id
}

output "zone_name" {
  description = "Apex domain name"
  value       = cloudflare_zone.this.name
}

output "name_servers" {
  description = "Set these at the registrar"
  value       = cloudflare_zone.this.name_servers
}

output "dnssec_ds" {
  description = "Enter this DS record at the registrar, AFTER DNSSEC is active here"
  value       = cloudflare_zone_dnssec.this.ds
}

output "dnssec_details" {
  description = "Field-by-field form of the DS record, for registrars that ask for each part separately"
  value = {
    key_tag          = cloudflare_zone_dnssec.this.key_tag
    algorithm        = cloudflare_zone_dnssec.this.algorithm
    digest           = cloudflare_zone_dnssec.this.digest
    digest_type      = cloudflare_zone_dnssec.this.digest_type
    digest_algorithm = cloudflare_zone_dnssec.this.digest_algorithm
    public_key       = cloudflare_zone_dnssec.this.public_key
  }
}
