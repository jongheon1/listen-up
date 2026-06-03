#!/usr/bin/env bash
# Swap AWS Route 53 Registrar nameservers to Cloudflare's.
# Destructive-ish: cuts over DNS authority for the domain.
# Run only after Worker+Pages verified on workers.dev/pages.dev URLs.

set -euo pipefail

cd "$(dirname "$0")/.."

DOMAIN="${DOMAIN:-jongheon.click}"
REGION="${REGION:-us-east-1}" # route53domains is global, billed via us-east-1

NS_JSON=$(cd infra && terraform output -json cloudflare_nameservers)
mapfile -t NS < <(node -e "process.stdout.write(JSON.parse(process.argv[1]).join('\n'))" "$NS_JSON")

if [ "${#NS[@]}" -lt 2 ]; then
  echo "Need at least 2 nameservers; got: ${NS[*]}"
  exit 1
fi

echo "Setting $DOMAIN nameservers to:"
for n in "${NS[@]}"; do echo "  - $n"; done

ARGS=()
for n in "${NS[@]}"; do ARGS+=("Name=$n"); done

aws route53domains update-domain-nameservers \
    --domain-name "$DOMAIN" \
    --region "$REGION" \
    --nameservers "${ARGS[@]}"

echo
echo "Submitted. Propagation: usually 5min~1h, can take up to 48h."
echo "Watch:  dig +short NS $DOMAIN @8.8.8.8"
