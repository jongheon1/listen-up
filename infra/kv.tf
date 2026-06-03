resource "cloudflare_workers_kv_namespace" "meta" {
  account_id = var.cloudflare_account_id
  title      = var.kv_namespace_title
}

output "kv_namespace_id" {
  description = "Paste into workers/wrangler.toml [[kv_namespaces]] id"
  value       = cloudflare_workers_kv_namespace.meta.id
}

output "r2_bucket_name" {
  value = cloudflare_r2_bucket.media.name
}
