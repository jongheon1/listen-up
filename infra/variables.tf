variable "cloudflare_api_token" {
  type        = string
  sensitive   = true
  description = "Cloudflare Account API token (env: TF_VAR_cloudflare_api_token)"
}

variable "cloudflare_account_id" {
  type        = string
  description = "Cloudflare Account ID"
}

variable "domain" {
  type        = string
  default     = "jongheon.click"
  description = "Apex domain (zone) hosted on Cloudflare"
}

variable "app_hostname" {
  type        = string
  default     = "listen.jongheon.click"
  description = "Hostname the Worker serves on"
}

variable "r2_bucket_name" {
  type    = string
  default = "listen-up-media"
}

variable "kv_namespace_title" {
  type    = string
  default = "listen-up-meta"
}

variable "pages_project_name" {
  type    = string
  default = "listen-up"
}

variable "worker_script_name" {
  type    = string
  default = "listen-up-api"
}
