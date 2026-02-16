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

# Optional: copy latest backup to another server (no external service required)
# Set BACKUP_REMOTE_HOST (required), BACKUP_REMOTE_USER, BACKUP_REMOTE_PATH, and optionally BACKUP_SSH_KEY
if [[ -n "${BACKUP_REMOTE_HOST:-}" ]]; then
  LATEST="$(ls -1t "$BACKUP_DIR"/locallink-db-*.sql.gz 2>/dev/null | head -n 1)"
  if [[ -n "$LATEST" && -f "$LATEST" ]]; then
    REMOTE_USER="${BACKUP_REMOTE_USER:-$USER}"
    REMOTE_PATH="${BACKUP_REMOTE_PATH:-backups}"
    REMOTE_DEST="${REMOTE_USER}@${BACKUP_REMOTE_HOST}:${REMOTE_PATH}/"
    if command -v rsync &>/dev/null; then
      if [[ -n "${BACKUP_SSH_KEY:-}" && -f "${BACKUP_SSH_KEY}" ]]; then
        rsync -avz -e "ssh -i $BACKUP_SSH_KEY -o StrictHostKeyChecking=accept-new" "$LATEST" "$REMOTE_DEST" || true
      else
        rsync -avz -e "ssh -o StrictHostKeyChecking=accept-new" "$LATEST" "$REMOTE_DEST" || true
      fi
      echo "Remote copy (rsync) to $REMOTE_DEST done (or skipped on error)."
    else
      if [[ -n "${BACKUP_SSH_KEY:-}" && -f "${BACKUP_SSH_KEY}" ]]; then
        scp -i "$BACKUP_SSH_KEY" -o StrictHostKeyChecking=accept-new "$LATEST" "$REMOTE_DEST" || true
      else
        scp -o StrictHostKeyChecking=accept-new "$LATEST" "$REMOTE_DEST" || true
      fi
      echo "Remote copy (scp) to $REMOTE_DEST done (or skipped on error)."
    fi
  fi
fi

