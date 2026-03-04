#!/usr/bin/env bash
# Run this from your Mac to redeploy the app on Oracle Cloud (or any SSH host) via SSH.
# Prereqs: push your latest code to main first.

set -e

KEY="${LOCALLINK_PEM:-$HOME/Desktop/ssh-key-2026-02-18 (2).key}"
HOST="${LOCALLINK_HOST:-140.238.93.79}"
USER="${LOCALLINK_SSH_USER:-ubuntu}"
# On the server: path to the LocalLink repo (contains docker-compose.selfhost.yml). Default: LocalLink (i.e. ~/LocalLink when SSH starts in home).
REPO_DIR="${LOCALLINK_REPO_DIR:-LocalLink}"

if [[ ! -f "$KEY" ]]; then
  echo "Key not found: $KEY"
  echo "Run this script from your Mac (not on the server). Set LOCALLINK_PEM to your key path if it's elsewhere (e.g. ~/.ssh/locallink_ssh_key)."
  exit 1
fi

chmod 400 "$KEY" 2>/dev/null || true

echo "Redeploying on $HOST ($USER@$HOST), directory on server: $REPO_DIR"
# 1) Pull latest 2) Rebuild web image with no cache 3) Recreate web + gateway so new bundle is served 4) Migrate
CMD="cd $REPO_DIR && git fetch origin && git checkout main && git reset --hard origin/main && git clean -fd && echo \"Deploying commit: \$(git rev-parse --short HEAD)\" && docker compose -f docker-compose.selfhost.yml build --no-cache web && docker compose -f docker-compose.selfhost.yml up -d --force-recreate web gateway && docker compose -f docker-compose.selfhost.yml run --rm api npm run migrate && echo \"Web image: \$(docker compose -f docker-compose.selfhost.yml images -q web)\""
if ! ssh -i "$KEY" -o StrictHostKeyChecking=accept-new "$USER@$HOST" "$CMD"; then
  echo ""
  echo "Failed. The repo may not be at ~/$REPO_DIR on the server."
  echo "To find the project on the server, run:"
  echo "  ssh -i \"$KEY\" $USER@$HOST 'find \$HOME -name docker-compose.selfhost.yml 2>/dev/null'"
  echo "Then redeploy with the directory that *contains* that file, e.g.:"
  echo "  LOCALLINK_REPO_DIR=/home/ubuntu/MyLocalLink ./scripts/redeploy-ssh.sh"
  exit 1
fi

echo ""
echo "Done. Open https://locallink.agency/ in a NEW incognito/private window (or clear site data + hard refresh)."
echo "Footer should show only \"LOCALLINK.agency 2026 ©\" (no \"Build ... UTC\"). View Page Source and look for \"<!-- build\" to confirm new bundle."
