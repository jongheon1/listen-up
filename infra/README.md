# Cloudflare infrastructure (Terraform)

Manages: R2 bucket, KV namespace, Zone (jongheon.click), DNS, Pages project + custom domain, Worker route.

Worker **code** is deployed separately by Wrangler from `../workers`. Terraform only owns the route binding (`${app_hostname}/api/*` → script `listen-up-api`).

## Usage

```bash
# Credentials (do not commit)
export TF_VAR_cloudflare_api_token="$CLOUDFLARE_SECRET"
export TF_VAR_cloudflare_account_id="$CLOUDFLARE_ID"

terraform init
terraform plan
terraform apply
```

Outputs `cloudflare_nameservers` — feed those into the AWS Route 53 Registrar to migrate DNS hosting.
