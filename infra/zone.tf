resource "cloudflare_zone" "this" {
  account = {
    id = var.cloudflare_account_id
  }
  name = var.domain
  type = "full"
}

output "cloudflare_nameservers" {
  description = "Set these as NS records at the domain registrar (AWS Route 53 Registrar)"
  value       = cloudflare_zone.this.name_servers
}

output "zone_id" {
  value = cloudflare_zone.this.id
}
