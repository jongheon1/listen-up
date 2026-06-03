#!/usr/bin/env bash
# Full deploy: Terraform → KV id injection → Worker → Pages.
# Idempotent. Run from repo root.
#
# Required in env or .env:
#   CLOUDFLARE_ID         (account id)
#   CLOUDFLARE_SECRET     (CF API token)
#   OPENAI_API_KEY        (only needed first time to set secret)

set -euo pipefail

cd "$(dirname "$0")/.."

# Load .env if present
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

: "${CLOUDFLARE_ID:?Set CLOUDFLARE_ID in .env}"
: "${CLOUDFLARE_SECRET:?Set CLOUDFLARE_SECRET in .env}"

export CLOUDFLARE_API_TOKEN="$CLOUDFLARE_SECRET"
export CLOUDFLARE_ACCOUNT_ID="$CLOUDFLARE_ID"
export TF_VAR_cloudflare_api_token="$CLOUDFLARE_SECRET"
export TF_VAR_cloudflare_account_id="$CLOUDFLARE_ID"

echo "=== [1/5] terraform apply ==="
(
  cd infra
  if [ ! -d .terraform ]; then terraform init; fi
  terraform apply -auto-approve
)

KV_ID=$(cd infra && terraform output -raw kv_namespace_id)
echo "  KV id: $KV_ID"

echo "=== [2/5] inject KV id into workers/wrangler.toml ==="
# In-place replace placeholder OR existing id line
if grep -q "REPLACE_WITH_KV_ID" workers/wrangler.toml; then
  sed -i.bak "s/REPLACE_WITH_KV_ID/$KV_ID/" workers/wrangler.toml && rm workers/wrangler.toml.bak
else
  sed -i.bak -E "s/^id = \".*\"/id = \"$KV_ID\"/" workers/wrangler.toml && rm workers/wrangler.toml.bak
fi

echo "=== [3/5] OpenAI secret (skip if already set) ==="
(
  cd workers
  if ! npx wrangler secret list 2>/dev/null | grep -q OPENAI_API_KEY; then
    if [ -z "${OPENAI_API_KEY:-}" ]; then
      echo "  OPENAI_API_KEY not in env — set manually: cd workers && npx wrangler secret put OPENAI_API_KEY"
    else
      echo "$OPENAI_API_KEY" | npx wrangler secret put OPENAI_API_KEY
    fi
  else
    echo "  already set"
  fi
)

echo "=== [4/5] Deploy Worker ==="
(cd workers && npx wrangler deploy)

echo "=== [5/5] Build & Deploy Pages ==="
# Build frontend bundle from public-src/ into public/
npm run build:frontend
(
  cd workers
  npx wrangler pages deploy ../public --project-name="${PAGES_PROJECT:-listen-up}" --branch=main --commit-dirty=true
)

echo "=== Done ==="
echo "Worker:  https://listen-up-api.<your-subdomain>.workers.dev"
echo "Pages:   https://listen-up.pages.dev (or custom: https://listen.jongheon.click after NS swap)"
