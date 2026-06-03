#!/usr/bin/env bash
# Migrate listen-up data from EC2 to Cloudflare (R2 + KV).
#
# Idempotent: rerunning re-uploads (R2 overwrite); KV writes overwrite.

set -euo pipefail

cd "$(dirname "$0")/.."

# Load .env for CLOUDFLARE_ID/CLOUDFLARE_SECRET
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi
export CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_TOKEN:-${CLOUDFLARE_SECRET:-}}"
export CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-${CLOUDFLARE_ID:-}}"

EC2_HOST="${EC2_HOST:-ubuntu@3.34.35.160}"
EC2_REMOTE_PATH="${EC2_REMOTE_PATH:-/home/ubuntu/listen-up/data}"
PEM="${PEM:-listen-up-key.pem}"
TMP=".migrate-tmp"
BUCKET="${R2_BUCKET:-listen-up-media}"
KV_BINDING="META"

if [ ! -f "$PEM" ]; then echo "Missing $PEM"; exit 1; fi
if [ ! -f workers/wrangler.toml ]; then echo "Run from repo root"; exit 1; fi

LOCAL="$TMP/data"

echo "=== 1. Download data from EC2 ==="
if [ ! -d "$LOCAL" ]; then
  mkdir -p "$TMP"
  scp -i "$PEM" -o StrictHostKeyChecking=no -r "$EC2_HOST:$EC2_REMOTE_PATH" "$TMP/"
fi
echo "  $(du -sh "$LOCAL" | cut -f1) in $LOCAL"

cd workers
shopt -s nullglob

echo "=== 2. Upload audio to R2 ==="
for f in "../$LOCAL"/audio/*.mp3; do
  base=$(basename "$f")
  echo "  audio/$base"
  npx wrangler r2 object put "$BUCKET/audio/$base" --file "$f" --content-type audio/mpeg
done

echo "=== 3. Upload STT JSON to R2 ==="
for f in "../$LOCAL"/stt/*.json; do
  base=$(basename "$f")
  echo "  stt/$base"
  npx wrangler r2 object put "$BUCKET/stt/$base" --file "$f" --content-type application/json
done

echo "=== 4. Upload meta + settings to KV ==="
if [ -f "../$LOCAL/meta.json" ]; then
  npx wrangler kv key put --binding="$KV_BINDING" meta --path "../$LOCAL/meta.json"
fi
if [ -f "../$LOCAL/settings.json" ]; then
  npx wrangler kv key put --binding="$KV_BINDING" settings --path "../$LOCAL/settings.json"
fi

cd ..
echo "=== Done. Temp data in $TMP — delete after verification. ==="
