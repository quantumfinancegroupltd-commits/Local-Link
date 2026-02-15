#!/usr/bin/env bash
set -euo pipefail

# LocalLink self-host DB restore (DANGEROUS: overwrites DB)
# Usage (on EC2): ./scripts/restore_db.sh backups/locallink-db-<stamp>.sql.gz

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <backup.sql.gz>"
  exit 1
fi

BACKUP_PATH="$1"
if [[ ! -f "$BACKUP_PATH" ]]; then
  echo "Backup file not found: $BACKUP_PATH"
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.selfhost.yml}"

echo "This will OVERWRITE the database 'locallink'."
echo "Backup: $BACKUP_PATH"
read -r -p "Type RESTORE to continue: " CONFIRM
if [[ "$CONFIRM" != "RESTORE" ]]; then
  echo "Cancelled."
  exit 1
fi

echo "Stopping API/worker to prevent writes during restore..."
docker compose -f "$COMPOSE_FILE" stop api worker || true

echo "Dropping and recreating database..."
docker compose -f "$COMPOSE_FILE" exec -T db psql -U locallink -d postgres -v ON_ERROR_STOP=1 <<'SQL'
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'locallink' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS locallink;
CREATE DATABASE locallink;
SQL

echo "Restoring..."
gunzip -c "$BACKUP_PATH" | docker compose -f "$COMPOSE_FILE" exec -T db psql -U locallink -d locallink -v ON_ERROR_STOP=1

echo "Starting services..."
docker compose -f "$COMPOSE_FILE" up -d api worker

echo "Restore complete."


