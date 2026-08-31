#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_NAME="politiker-eu"
BASELINE="0000_current_baseline.sql"
WR=(npx wrangler)

cd "$REPO_DIR/app"

query() {
  "${WR[@]}" d1 execute "$DB_NAME" --remote --yes --command "$1"
}

has_table() {
  query "SELECT 'FOUND_TABLE' AS marker FROM sqlite_master WHERE type='table' AND name='$1' LIMIT 1" 2>/dev/null \
    | grep -Fq 'FOUND_TABLE'
}

has_native_baseline() {
  has_table d1_migrations || return 1
  query "SELECT 'FOUND_BASELINE' AS marker FROM d1_migrations WHERE name='$BASELINE' LIMIT 1" 2>/dev/null \
    | grep -Fq 'FOUND_BASELINE'
}

verify_legacy_state() {
  local migration name
  for migration in "$REPO_DIR"/infra/legacy-migrations/*.sql; do
    name=$(basename "$migration")
    if ! query "SELECT 'FOUND_MIGRATION' AS marker FROM schema_migrations WHERE filename='$name' LIMIT 1" 2>/dev/null \
      | grep -Fq 'FOUND_MIGRATION'; then
      echo "FEL: legacy migration saknar verifierat state: $name" >&2
      return 1
    fi
  done

  local structure_check
  structure_check="SELECT CASE WHEN
    EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='politician_assignments')
    AND EXISTS (SELECT 1 FROM sqlite_master WHERE type='trigger' AND name='accounts_email_nocase_insert')
    AND EXISTS (SELECT 1 FROM sqlite_master WHERE type='trigger' AND name='accounts_email_nocase_update')
    AND EXISTS (SELECT 1 FROM sqlite_master WHERE type='index' AND name='idx_politicians_email_normalized')
    AND EXISTS (SELECT 1 FROM sqlite_master WHERE type='index' AND name='idx_send_jobs_status_created')
    THEN 'LEGACY_READY' ELSE 'LEGACY_NOT_READY' END AS marker"

  if ! query "$structure_check" 2>/dev/null | grep -Fq 'LEGACY_READY'; then
    echo "FEL: produktions-D1 matchar inte den förväntade slutstrukturen; native baseline avbryts." >&2
    return 1
  fi
}

seed_native_baseline() {
  query "CREATE TABLE IF NOT EXISTS d1_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
    INSERT OR IGNORE INTO d1_migrations (name) VALUES ('$BASELINE');" >/dev/null
}

if has_table politicians && ! has_native_baseline; then
  echo "Befintlig D1 upptäckt; verifierar och migrerar legacy-state en gång."

  if ! has_table schema_migrations; then
    echo "FEL: befintlig D1 saknar både native baseline och legacy schema_migrations; vägrar gissa state." >&2
    exit 1
  fi

  # Sista användningen av den äldre motorn säkerställer att alla historiska
  # migrationer faktiskt är applicerade innan native state markeras.
  bash "$REPO_DIR/infra/apply-migrations.sh"
  verify_legacy_state
  seed_native_baseline
  echo "Native D1-baseline registrerad."
fi

# Tomma databaser applicerar hela native kedjan från 0000. Befintliga databaser
# fortsätter från den seedade baslinjen. I CI/CD hoppar Wrangler automatiskt över
# den interaktiva bekräftelsen, så ingen separat yes-flagga ska anges här.
"${WR[@]}" d1 migrations apply "$DB_NAME" --remote
