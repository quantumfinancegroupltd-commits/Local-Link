#!/usr/bin/env bash
# Run this from your Mac to redeploy the app on Oracle Cloud (or any SSH host) via SSH.
# Prereqs: push your latest code to main first.

set -e

KEY="${LOCALLINK_PEM:-$HOME/Downloads/ssh-key-2026-02-18 (2).key}"
HOST="${LOCALLINK_HOST:-140.238.93.79}"
USER="${LOCALLINK_SSH_USER:-ubuntu}"
# On the server: path to the LocalLink repo (contains docker-compose.selfhost.yml). Default: LocalLink = ~/LocalLink on server.
REPO_DIR="${LOCALLINK_REPO_DIR:-LocalLink}"

if [[ ! -f "$KEY" ]]; then
  echo "Key not found: $KEY"
  echo "Set LOCALLINK_PEM to your key path if it's elsewhere."
  exit 1
fi

chmod 400 "$KEY" 2>/dev/null || true

echo "Redeploying on $HOST ($USER@$HOST), directory on server: $REPO_DIR"
if ! ssh -i "$KEY" -o StrictHostKeyChecking=accept-new "$USER@$HOST" "cd $REPO_DIR && git fetch origin && git checkout main && git pull origin main && docker compose -f docker-compose.selfhost.yml up -d --build && docker compose -f docker-compose.selfhost.yml run --rm api npm run migrate"; then
  echo ""
  echo "Failed. The repo may not be at ~/$REPO_DIR on the server."
  echo "To find the project on the server, run:"
  echo "  ssh -i \"$KEY\" $USER@$HOST 'find \$HOME -name docker-compose.selfhost.yml 2>/dev/null'"
  echo "Then redeploy with the directory that *contains* that file, e.g.:"
  echo "  LOCALLINK_REPO_DIR=/home/ubuntu/MyLocalLink ./scripts/redeploy-ssh.sh"
  exit 1
fi

echo "Done. In a few seconds, open https://locallink.agency/ and hard refresh (Cmd+Shift+R)."
echo "Inspect the page for data-build=\"locallink-2025-02-events-domestic-live\" to confirm the new frontend is live."
