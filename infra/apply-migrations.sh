#!/usr/bin/env bash

# Applicera endast nya D1-migreringar före driftsättning. De fem första
# migrationerna fanns redan i produktionsdatabasen innan automatisk spårning
# infördes och registreras därför som historisk baslinje.

set -euo pipefail

REPO_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
DB_NAME="politiker"
wrangler() {
  npx wrangler "$@" --config "$REPO_DIR/wrangler.jsonc"
}

cd "$REPO_DIR/app"
wrangler d1 execute "$DB_NAME" --remote --yes --command \
  "CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)" >/dev/null

for baseline in \
  001_visits.sql \
  002_visits_country.sql \
  003_client_errors.sql \
  004_newsletter.sql \
  005_daily_api_usage.sql; do
  wrangler d1 execute "$DB_NAME" --remote --yes --command \
    "INSERT OR IGNORE INTO schema_migrations (filename, applied_at) VALUES ('$baseline', 0)" >/dev/null
done

for migration in "$REPO_DIR"/infra/migrations/*.sql; do
  filename=$(basename "$migration")
  if wrangler d1 execute "$DB_NAME" --remote --yes --command \
    "SELECT 'MIGRATION_APPLIED' FROM schema_migrations WHERE filename = '$filename'" 2>/dev/null \
    | grep -Fq "MIGRATION_APPLIED"; then
    continue
  fi

  wrangler d1 execute "$DB_NAME" --remote --yes --file "$migration" >/dev/null
  wrangler d1 execute "$DB_NAME" --remote --yes --command \
    "INSERT INTO schema_migrations (filename, applied_at) VALUES ('$filename', $(date +%s))" >/dev/null
  echo "Applicerat $filename"
done
