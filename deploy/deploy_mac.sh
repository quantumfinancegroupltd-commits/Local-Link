#!/usr/bin/env bash
set -euo pipefail

# LocalLink deployment helper (run on your Mac).
# - Uses rsync for fast incremental deploys
# - Prevents overwriting production secrets by excluding docker-compose.selfhost.yml
#
# Usage:
#   ./deploy/deploy_mac.sh ec2-user@ec2-18-130-159-10.eu-west-2.compute.amazonaws.com ~/Downloads/LocalLink.pem
#

HOST="${1:-}"
KEY="${2:-}"

if [[ -z "$HOST" || -z "$KEY" ]]; then
  echo "Usage: $0 <ssh_host_user@host> <path_to_pem_key>"
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

rsync -az --delete \
  --exclude-from "${ROOT_DIR}/deploy/rsync-exclude.txt" \
  -e "ssh -i ${KEY}" \
  "${ROOT_DIR}/" \
  "${HOST}:~/LocalLink/"

echo "✅ Synced code to ${HOST}:~/LocalLink"
echo "Next, SSH to the server and run:"
echo "  cd ~/LocalLink && docker compose -f docker-compose.selfhost.yml up -d --build && docker compose -f docker-compose.selfhost.yml exec -T api npm run migrate"


