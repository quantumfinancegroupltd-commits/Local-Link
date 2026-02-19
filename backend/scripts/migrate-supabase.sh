#!/usr/bin/env bash
# Run migrations against your Supabase project (project ref: bjrxwtvceihqykkwzxku).
# Usage: ./scripts/migrate-supabase.sh
# You will be asked for your Supabase database password once.

set -e
cd "$(dirname "$0")/.."
PROJECT_REF="bjrxwtvceihqykkwzxku"

echo "Supabase migrate (project: $PROJECT_REF)"
echo "Enter your Supabase database password (from Project Settings → Database):"
read -rs SUPABASE_PASS
echo ""

export NODE_OPTIONS="--dns-result-order=ipv4first"
export DATABASE_URL="postgresql://postgres:${SUPABASE_PASS}@db.${PROJECT_REF}.supabase.co:5432/postgres?sslmode=require"
npm run migrate

echo ""
echo "Done. Use the same password in .env on the server for DATABASE_URL."
