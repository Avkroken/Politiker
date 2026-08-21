#!/usr/bin/env bash

# Applicera endast nya D1-migreringar före driftsättning. De fem första
# migrationerna kan ha funnits i produktionsdatabasen innan automatisk
# spårning infördes. De registreras som historisk baslinje endast när deras
# schema faktiskt finns; annars lämnas de omarkerade och appliceras nedan.

set -euo pipefail

REPO_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
DB_NAME="politiker"
WR="npx wrangler"

cd "$REPO_DIR/app"
$WR d1 execute "$DB_NAME" --remote --yes --command \
  "CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)" >/dev/null

baseline_present() {
  local baseline="$1"
  local sql

  case "$baseline" in
    001_visits.sql)
      sql="SELECT 'BASELINE_PRESENT' FROM sqlite_master WHERE type = 'table' AND name = 'visits'"
      ;;
    002_visits_country.sql)
      sql="SELECT 'BASELINE_PRESENT' FROM pragma_table_info('visits') WHERE name = 'country'"
      ;;
    003_client_errors.sql)
      sql="SELECT 'BASELINE_PRESENT' FROM sqlite_master WHERE type = 'table' AND name = 'client_errors'"
      ;;
    004_newsletter.sql)
      sql="SELECT 'BASELINE_PRESENT' WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'newsletter_subscribers') AND EXISTS (SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'newsletter_sends')"
      ;;
    005_daily_api_usage.sql)
      sql="SELECT 'BASELINE_PRESENT' FROM sqlite_master WHERE type = 'table' AND name = 'daily_api_usage'"
      ;;
    *)
      return 1
      ;;
  esac

  $WR d1 execute "$DB_NAME" --remote --yes --command "$sql" 2>/dev/null \
    | grep -Fq "BASELINE_PRESENT"
}

for baseline in \
  001_visits.sql \
  002_visits_country.sql \
  003_client_errors.sql \
  004_newsletter.sql \
  005_daily_api_usage.sql; do
  if baseline_present "$baseline"; then
    $WR d1 execute "$DB_NAME" --remote --yes --command \
      "INSERT OR IGNORE INTO schema_migrations (filename, applied_at) VALUES ('$baseline', 0)" >/dev/null
  else
    echo "Baslinje saknas i D1; applicerar migration: $baseline"
  fi
done

for migration in "$REPO_DIR"/infra/migrations/*.sql; do
  filename=$(basename "$migration")
  if $WR d1 execute "$DB_NAME" --remote --yes --command \
    "SELECT 'MIGRATION_APPLIED' FROM schema_migrations WHERE filename = '$filename'" 2>/dev/null \
    | grep -Fq "MIGRATION_APPLIED"; then
    continue
  fi

  $WR d1 execute "$DB_NAME" --remote --yes --file "$migration" >/dev/null
  $WR d1 execute "$DB_NAME" --remote --yes --command \
    "INSERT INTO schema_migrations (filename, applied_at) VALUES ('$filename', $(date +%s))" >/dev/null
  echo "Applicerat $filename"
done
