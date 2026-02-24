#!/usr/bin/env bash
set -euo pipefail

# LocalLink deployment (run on your Mac).
# Syncs code to server; with "full" runs backend/frontend build and pm2 restart.
#
# Usage:
#   ./deploy/deploy_mac.sh [full]
#   ./deploy/deploy_mac.sh ubuntu@140.238.93.79 "/path/to/key.pem" [full]
#
# Default host and key (locallink.agency)
DEFAULT_HOST="ubuntu@140.238.93.79"
DEFAULT_KEY="$HOME/Downloads/Local Link SSH Key/ssh-key-2026-02-18 (2).key"

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
  echo "Running build + migrate + pm2 restart on server..."
  ssh -i "$KEY" "$HOST" 'cd ~/LocalLink/backend && npm ci && npm run migrate && node scripts/seed-demo-users.js && cd ~/LocalLink/frontend && npm ci && npm run build && cd ~/LocalLink && pm2 restart locallink-api locallink-worker'
  echo "✅ Deploy complete. Open https://locallink.agency/ and hard-refresh (Cmd+Shift+R)."
else
  echo "Next: SSH and run build, or run: $0 $HOST \"$KEY\" full"
fi


