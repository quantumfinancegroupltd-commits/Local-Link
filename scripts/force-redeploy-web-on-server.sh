#!/usr/bin/env bash
# Run this ON THE SERVER (after SSH) to force the frontend to update.
# Use when the site still shows old UI (e.g. "Build 2026-03-04 ... UTC") after a normal deploy.
# From your Mac: ssh -i ~/.ssh/locallink_ssh_key ubuntu@140.238.93.79
# Then: cd ~/LocalLink && bash scripts/force-redeploy-web-on-server.sh

set -e
cd "$(dirname "$0")/.."
COMPOSE="docker compose -f docker-compose.selfhost.yml"

echo "1. Pulling latest code..."
git fetch origin
git checkout main
git reset --hard origin/main
git clean -fd
echo "   Commit: $(git rev-parse --short HEAD)"

echo ""
echo "2. Stopping web + gateway and removing web container + image..."
$COMPOSE stop web gateway 2>/dev/null || true
$COMPOSE rm -f web gateway 2>/dev/null || true
# Remove the web image so the next build is the only one
WEB_IMAGE=$($COMPOSE images -q web 2>/dev/null || true)
if [ -n "$WEB_IMAGE" ]; then
  docker rmi -f "$WEB_IMAGE" 2>/dev/null || true
fi

echo ""
echo "3. Rebuilding web image (no cache)..."
$COMPOSE build --no-cache web

echo ""
echo "4. Starting web and gateway..."
$COMPOSE up -d web gateway

echo ""
echo "5. Running migrations..."
$COMPOSE run --rm api npm run migrate

echo ""
echo "6. Restarting Caddy (clear any proxy cache)..."
sudo systemctl restart caddy 2>/dev/null || true

echo ""
echo "7. Verify: script name in built index.html (should NOT be index-BZdWTx5c.js):"
$COMPOSE exec web cat /usr/share/nginx/html/index.html 2>/dev/null | grep -o 'index-[^.]*\.js' || echo "(could not read)"

echo ""
echo "Done. Wait 15s, then open https://locallink.agency/ in a NEW incognito window."
