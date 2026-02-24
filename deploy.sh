#!/usr/bin/env bash
# One command to deploy: commit, push, then redeploy on server.
# Run from repo root: ./deploy.sh

set -e
cd "$(dirname "$0")"

echo "=== LocalLink deploy ==="

if [[ -n $(git status -s) ]]; then
  echo "Committing and pushing..."
  git add -A
  git commit -m "Deploy" || true
  git push origin main
else
  echo "No local changes; pushing current branch..."
  git push origin main || true
fi

echo ""
echo "Redeploying on server..."
./scripts/redeploy-ssh.sh

echo ""
echo "All done. Open https://locallink.agency/ and hard refresh (Cmd+Shift+R)."
