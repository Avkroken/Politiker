#!/usr/bin/env bash

# Applicera endast migrationer som tillkommit efter den squashade baslinjen.
# Nya installationer skapas från infra/schema.sql; befintliga installationer
# behåller sitt schema och får bara nya filer i infra/migrations/.

set -euo pipefail

REPO_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
DB_NAME="politiker"
WR="npx wrangler"

cd "$REPO_DIR/app"
$WR d1 execute "$DB_NAME" --remote --yes --command \
  "CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)" >/dev/null

shopt -s nullglob
migrations=("$REPO_DIR"/infra/migrations/*.sql)

if [ ${#migrations[@]} -eq 0 ]; then
  echo "Inga nya databasmigrationer."
  exit 0
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
  echo "Applicerat $filename"
done
