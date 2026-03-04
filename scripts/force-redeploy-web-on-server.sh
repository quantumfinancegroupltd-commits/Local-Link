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
echo "2. Stopping and removing web + gateway containers..."
$COMPOSE stop web gateway 2>/dev/null || true
$COMPOSE rm -f web gateway 2>/dev/null || true

echo ""
echo "3. Rebuilding web image (no cache)..."
$COMPOSE build --no-cache web

echo ""
echo "4. Starting web and gateway (new containers)..."
$COMPOSE up -d web gateway

echo ""
echo "5. Running migrations..."
$COMPOSE run --rm api npm run migrate

echo ""
echo "Done. Wait ~10 seconds, then open https://locallink.agency/ in a new incognito window."
echo "Check: curl -sI https://locallink.agency/ and View Page Source for a new script name (not index-BZdWTx5c.js)."
