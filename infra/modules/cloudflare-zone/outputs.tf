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
