#!/usr/bin/env bash
# One command: API smoke test (default: production). Add RUN_E2E=1 to also run Playwright.
#   ./scripts/run-all-tests.sh
#   RUN_E2E=1 ./scripts/run-all-tests.sh
set -euo pipefail

BASE_URL="${BASE_URL:-https://locallink.agency}"
API="${BASE_URL}/api"
RUN_E2E="${RUN_E2E:-0}"

echo "=== API smoke test ($BASE_URL) ==="
if ! BASE_URL="$BASE_URL" ./scripts/smoke-test.sh; then
  echo "Smoke test failed."
  exit 1
fi

if [ "$RUN_E2E" = "1" ]; then
  if ! command -v npm >/dev/null 2>&1; then
    echo ""
    echo "Skipping Playwright E2E (npm not found — run this on your Mac: RUN_E2E=1 ./scripts/run-all-tests.sh)"
  else
    echo ""
    echo "=== Playwright E2E ==="
    ROOT="$(cd "$(dirname "$0")/.." && pwd)"
    cd "$ROOT/frontend"
    export E2E_BASE_URL="${E2E_BASE_URL:-$BASE_URL}"
    npm run e2e
  fi
fi

echo ""
echo "Done."
