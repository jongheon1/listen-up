# A proxied placeholder record for the app hostname.
# Pages attaches itself to this hostname via cloudflare_pages_domain; the proxy
# layer routes /api/* to the Worker (via cloudflare_workers_route) and everything
# else to Pages.
data "cloudflare_pages_project" "frontend" {
  account_id   = var.cloudflare_account_id
  project_name = cloudflare_pages_project.frontend.name
}

resource "cloudflare_dns_record" "app" {
  zone_id = cloudflare_zone.this.id
  name    = var.app_hostname
  type    = "CNAME"
  content = data.cloudflare_pages_project.frontend.subdomain
  ttl     = 1 # auto, required when proxied
  proxied = true
}
