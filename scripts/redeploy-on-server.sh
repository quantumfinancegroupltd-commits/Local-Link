#!/usr/bin/env bash
# Run this ON THE SERVER (after SSH) from the directory that contains docker-compose.selfhost.yml.
# Use this if redeploy-ssh.sh isn't updating the site — it forces a full pull and rebuild.

set -e

echo "=== Current directory ==="
pwd
ls -la docker-compose.selfhost.yml 2>/dev/null || { echo "Run this from the LocalLink repo root (where docker-compose.selfhost.yml is)."; exit 1; }

echo ""
echo "=== Git status (before pull) ==="
git log -1 --oneline
git status -s

echo ""
echo "=== Pulling latest from origin/main ==="
git fetch origin
git checkout main
git reset --hard origin/main
git clean -fd
echo "Now at: $(git log -1 --oneline)"

echo ""
echo "=== Rebuilding web image (no cache) and restarting ==="
docker compose -f docker-compose.selfhost.yml build --no-cache web
docker compose -f docker-compose.selfhost.yml up -d --build

echo ""
echo "=== Running migrations ==="
docker compose -f docker-compose.selfhost.yml run --rm api npm run migrate

echo ""
echo "Done. Wait ~10s then open https://locallink.agency/ and hard refresh (Cmd+Shift+R)."
echo "Check the footer for 'Build YYYY-MM-DD HH:MM:SS UTC' to confirm the new build is live."
