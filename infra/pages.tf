resource "cloudflare_pages_project" "frontend" {
  account_id        = var.cloudflare_account_id
  name              = var.pages_project_name
  production_branch = "main"
}

# Custom domain for Pages — frontend served at apex hostname.
# Worker takes /api/* routes via worker route (see workers.tf).
resource "cloudflare_pages_domain" "frontend" {
  account_id   = var.cloudflare_account_id
  project_name = cloudflare_pages_project.frontend.name
  name         = var.app_hostname
  depends_on   = [cloudflare_dns_record.app]
}
