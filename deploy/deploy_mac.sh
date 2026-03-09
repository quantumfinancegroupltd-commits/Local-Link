#!/usr/bin/env bash
set -euo pipefail

# LocalLink deployment (run on your Mac).
# Syncs code to server; with "full" runs backend/frontend build and pm2 restart.
#
# Usage:
#   ./deploy/deploy_mac.sh [full]
#   ./deploy/deploy_mac.sh ubuntu@140.238.93.79 "/path/to/key.pem" [full]
#
# Default host and key (locallink.agency) — same as scripts/redeploy-ssh.sh
DEFAULT_HOST="ubuntu@140.238.93.79"
DEFAULT_KEY="${LOCALLINK_PEM:-$HOME/Desktop/ssh-key-2026-02-18 (2).key}"

FULL=""
if [[ "${1:-}" == "full" ]]; then FULL="full"; shift; fi
if [[ "${2:-}" == "full" ]]; then FULL="full"; shift; fi
if [[ "${*: -1}" == "full" ]]; then FULL="full"; fi

HOST="${1:-$DEFAULT_HOST}"
KEY="${2:-$DEFAULT_KEY}"
if [[ "$KEY" == "full" ]]; then KEY="$DEFAULT_KEY"; fi

if [[ -z "$HOST" || -z "$KEY" ]]; then
  echo "Usage: $0 [full]  OR  $0 [user@host] [key.pem] [full]"
  echo "  'full' = sync + build + migrate + pm2 restart (default host/key for locallink.agency)"
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Syncing to ${HOST}..."
rsync -az --delete \
  --exclude-from "${ROOT_DIR}/deploy/rsync-exclude.txt" \
  -e "ssh -i \"${KEY}\"" \
  "${ROOT_DIR}/" \
  "${HOST}:~/LocalLink/"

echo "✅ Synced code to ${HOST}:~/LocalLink"

if [[ -n "$FULL" ]]; then
  if [[ -f "${ROOT_DIR}/frontend/.env" ]]; then
    echo "Copying frontend/.env to server (for VITE_GOOGLE_MAPS_API_KEY at build time)..."
    scp -i "$KEY" "${ROOT_DIR}/frontend/.env" "${HOST}:~/LocalLink/frontend/.env"
  fi
  echo "Running migrate + web container rebuild (no cache) + economist seed in API container + pm2 restart on server..."
  ssh -i "$KEY" "$HOST" 'cd ~/LocalLink/backend && npm ci && npm run migrate && node scripts/seed-demo-users.js && cd ~/LocalLink && export VITE_GOOGLE_MAPS_API_KEY=$(grep -E "^VITE_GOOGLE_MAPS_API_KEY=" frontend/.env 2>/dev/null | cut -d= -f2-); docker compose -f docker-compose.selfhost.yml build --no-cache web api && docker compose -f docker-compose.selfhost.yml up -d web api && docker compose -f docker-compose.selfhost.yml run --rm api node scripts/seed-economist-issue.js && pm2 restart locallink-api locallink-worker'
  echo "✅ Deploy complete. Open https://locallink.agency/ in a new incognito/private window (or hard-refresh Cmd+Shift+R)."
else
  echo "Next: SSH and run build, or run: $0 $HOST \"$KEY\" full"
fi


