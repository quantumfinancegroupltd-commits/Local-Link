#!/usr/bin/env bash
set -euo pipefail

# LocalLink self-host DB backup (runs on the server)
# Usage (on EC2):  ./scripts/backup_db.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.selfhost.yml}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
KEEP="${KEEP:-14}" # keep last N dumps

mkdir -p "$BACKUP_DIR"

STAMP="$(date -u +"%Y-%m-%dT%H-%M-%SZ")"
OUT="$BACKUP_DIR/locallink-db-${STAMP}.sql.gz"

echo "Backing up DB to: $OUT"

docker compose -f "$COMPOSE_FILE" exec -T db \
  pg_dump -U locallink -d locallink --no-owner --no-privileges \
  | gzip -9 > "$OUT"

echo "Backup complete."

# Retention
ls -1t "$BACKUP_DIR"/locallink-db-*.sql.gz 2>/dev/null | tail -n +"$((KEEP + 1))" | xargs -r rm -f
echo "Retention: kept last $KEEP backups."


