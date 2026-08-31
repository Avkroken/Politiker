#!/usr/bin/env bash

# Transitional compatibility migrator used only by migrate-d1-native.sh while
# an existing production database still uses schema_migrations. New databases
# and all future schema changes use Wrangler's native D1 migrations.

set -euo pipefail

REPO_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
DB_NAME="politiker-eu"
WR="npx wrangler"

cd "$REPO_DIR/app"
$WR d1 execute "$DB_NAME" --remote --yes --command \
  "CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)" >/dev/null

shopt -s nullglob
migrations=("$REPO_DIR"/infra/legacy-migrations/*.sql)

if [ ${#migrations[@]} -eq 0 ]; then
  echo "FEL: legacy migrations saknas under infra/legacy-migrations" >&2
  exit 1
fi

for migration in "${migrations[@]}"; do
  filename=$(basename "$migration")
  if $WR d1 execute "$DB_NAME" --remote --yes --command \
    "SELECT 'MIGRATION_APPLIED' FROM schema_migrations WHERE filename = '$filename'" 2>/dev/null \
    | grep -Fq "MIGRATION_APPLIED"; then
    continue
  fi

  $WR d1 execute "$DB_NAME" --remote --yes --file "$migration" >/dev/null
  $WR d1 execute "$DB_NAME" --remote --yes --command \
    "INSERT INTO schema_migrations (filename, applied_at) VALUES ('$filename', $(date +%s))" >/dev/null
  echo "Applicerat legacy $filename"
done
