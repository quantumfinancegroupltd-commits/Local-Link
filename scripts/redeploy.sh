#!/usr/bin/env bash
# Run this on the server where LocalLink is deployed with docker-compose.selfhost.yml.
# From the repo root: ./scripts/redeploy.sh

set -e
cd "$(dirname "$0")/.."

echo "Fetching latest from origin..."
git fetch origin

echo "Checking out main and pulling..."
git checkout main
git pull origin main

echo "Rebuilding and restarting containers..."
docker compose -f docker-compose.selfhost.yml up -d --build

echo "Done. Give it a few seconds, then check https://locallink.agency/"
echo "Inspect the page for data-build=\"locallink-2025-02-events-domestic-live\" to confirm the new frontend is live."
