#!/usr/bin/env bash
# setup.sh — Provisionerar och deployar hela politiker i ETT kommando.
#
#   git clone … && cd politiker && bash infra/setup.sh
#
# Skapar Cloudflare-resurser (D1/KV/Queue/R2) i ditt inloggade konto, patchar
# wrangler-konfigurationen med dina resurs-ID:n, applicerar databasschemat,
# sätter secrets, deployar app-Workern och installerar
# bounce-processor (systemd). Idempotent — säker att köra om.
#
# Krav: Node 18+, npm, git, samt `wrangler login` (skriptet ber dig logga in
# om du inte redan är det). Ubuntu/Debian för bounce-processor-steget.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$HOME/.claude/credentials.env"
SERVICE_DIR="/etc/systemd/system"
CURRENT_USER="$(id -un)"
WR="npx --yes wrangler"

# Kanoniska resurs-ID:n i wrangler-filerna (ägarens konto). Patchas till dina.
PLACEHOLDER_DB_ID="e9ecf94f-fa71-4004-a5b8-f9317eb4d4e9"
DB_NAME="politiker"
LEGACY_DB_NAME="politiker_webapp"
KV_TITLE="politiker_sessions"
LEGACY_KV_TITLE="politiker_webapp_sessions"
QUEUE_NAME="politiker-send-jobs"
R2_BUCKET="politiker-attachments"
LEGACY_R2_BUCKET="politiker-webapp-attachments"
OWNER_DOMAIN="politiker.denied.se"

log()  { printf '\033[1;34m›\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m✓\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# Läs en variabel ur .env utan att evaluera filen som shellkod.
_get() { grep -m1 "^$1=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- | sed 's/^"//;s/"$//' | tr -d "'"; }
# Skriv tillbaka ett värde till .env (skapar raden om den saknas).
_set() {
  local k="$1" v="$2"
  if grep -q "^$k=" "$ENV_FILE"; then
    sed -i "s|^$k=.*|$k=$v|" "$ENV_FILE"
  else
    printf '%s=%s\n' "$k" "$v" >> "$ENV_FILE"
  fi
}

echo "=== politiker setup ==="
echo "Repokatalog: $REPO_DIR"

# ── 1. Beroenden ────────────────────────────────────────────────────────────
log "[1/8] Kontrollerar beroenden…"
command -v node >/dev/null || die "Node 18+ krävs. Installera från https://nodejs.org och kör om."
command -v npm  >/dev/null || die "npm krävs (följer med Node)."
command -v openssl >/dev/null || die "openssl krävs."
if ! command -v jq >/dev/null; then
  log "  Installerar jq…"; sudo apt-get update -qq && sudo apt-get install -y jq
fi
if ! command -v python3 >/dev/null; then
  log "  Installerar python3…"; sudo apt-get install -y python3
fi
ok "Beroenden OK"

# ── 2. .env ───────────────────────────────────────────────────────────────
log "[2/8] Konfigurerar $ENV_FILE…"
mkdir -p "$(dirname "$ENV_FILE")"
if [ ! -f "$ENV_FILE" ]; then
  install -m 600 "$REPO_DIR/infra/.env.example" "$ENV_FILE"
  # Generera krypteringsnyckel direkt så användaren slipper.
  _set MAIL_CRED_KEY "$(openssl rand -base64 32)"
  ok "Skapade $ENV_FILE (MAIL_CRED_KEY genererad)"
  echo
  warn "Fyll i minst SYSTEM_SMTP_PASSWORD (och valfria fält) i:"
  echo "    $ENV_FILE"
  echo "Kör sedan om:  bash $REPO_DIR/infra/setup.sh"
  exit 0
fi
# Generera MAIL_CRED_KEY om den är tom.
if [ -z "$(_get MAIL_CRED_KEY)" ]; then
  _set MAIL_CRED_KEY "$(openssl rand -base64 32)"
  ok "Genererade MAIL_CRED_KEY"
fi
MAIL_CRED_KEY="$(_get MAIL_CRED_KEY)"
SYSTEM_SMTP_PASSWORD="$(_get SYSTEM_SMTP_PASSWORD)"
GITHUB_FEEDBACK_TOKEN="$(_get GITHUB_FEEDBACK_TOKEN)"
ANTHROPIC_API_KEY="$(_get ANTHROPIC_API_KEY)"
GMAIL_EMAIL="$(_get GMAIL_EMAIL)"
GMAIL_PASSWORD="$(_get GMAIL_PASSWORD)"
OAUTH_GOOGLE_CLIENT_SECRET="$(_get OAUTH_GOOGLE_CLIENT_SECRET)"
OAUTH_GITHUB_CLIENT_SECRET="$(_get OAUTH_GITHUB_CLIENT_SECRET)"
OAUTH_MICROSOFT_CLIENT_SECRET="$(_get OAUTH_MICROSOFT_CLIENT_SECRET)"
CUSTOM_DOMAIN="$(_get CUSTOM_DOMAIN)"
[ -n "$SYSTEM_SMTP_PASSWORD" ] || warn "SYSTEM_SMTP_PASSWORD är tom — verifieringsmail kommer inte fungera."
ok ".env inläst"

# ── 3. Cloudflare-inloggning ──────────────────────────────────────────────
log "[3/8] Kontrollerar Cloudflare-inloggning…"
if ! $WR whoami >/dev/null 2>&1; then
  warn "Inte inloggad. Öppnar webbläsarinloggning…"
  $WR login
fi
ok "Inloggad: $($WR whoami 2>/dev/null | grep -oE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+' | head -1 || echo 'okänt konto')"

# ── 4. Provisionera resurser (idempotent) ─────────────────────────────────
log "[4/8] Provisionerar Cloudflare-resurser…"

# D1
DB_ID="$($WR d1 list --json 2>/dev/null | jq -r ".[] | select(.name==\"$DB_NAME\") | (.uuid // .database_id // .id)" | head -1)"
NEW_DB=0
if [ -z "$DB_ID" ] || [ "$DB_ID" = "null" ]; then
  DB_ID="$($WR d1 list --json 2>/dev/null | jq -r ".[] | select(.name==\"$LEGACY_DB_NAME\") | (.uuid // .database_id // .id)" | head -1)"
  if [ -n "$DB_ID" ] && [ "$DB_ID" != "null" ]; then
    DB_NAME="$LEGACY_DB_NAME"
    log "  Återanvänder äldre D1-namn: $DB_NAME"
  fi
fi
if [ -z "$DB_ID" ] || [ "$DB_ID" = "null" ]; then
  log "  Skapar D1-databas $DB_NAME…"
  $WR d1 create "$DB_NAME" >/dev/null
  DB_ID="$($WR d1 list --json 2>/dev/null | jq -r ".[] | select(.name==\"$DB_NAME\") | (.uuid // .database_id // .id)" | head -1)"
  NEW_DB=1
fi
[ -n "$DB_ID" ] && [ "$DB_ID" != "null" ] || die "Kunde inte fastställa D1 database_id."
ok "D1: $DB_NAME ($DB_ID)"

# KV
KV_ID="$($WR kv namespace list 2>/dev/null | jq -r ".[] | select(.title==\"$KV_TITLE\") | .id" | head -1)"
if [ -z "$KV_ID" ] || [ "$KV_ID" = "null" ]; then
  KV_ID="$($WR kv namespace list 2>/dev/null | jq -r ".[] | select(.title==\"$LEGACY_KV_TITLE\") | .id" | head -1)"
  if [ -n "$KV_ID" ] && [ "$KV_ID" != "null" ]; then
    KV_TITLE="$LEGACY_KV_TITLE"
    log "  Återanvänder äldre KV-namn: $KV_TITLE"
  fi
fi
if [ -z "$KV_ID" ] || [ "$KV_ID" = "null" ]; then
  log "  Skapar KV-namespace $KV_TITLE…"
  KV_ID="$($WR kv namespace create "$KV_TITLE" 2>&1 | grep -oE '"?id"?[ :=]+"?[a-f0-9]{32}' | grep -oE '[a-f0-9]{32}' | head -1)"
fi
[ -n "$KV_ID" ] || die "Kunde inte fastställa KV-namespace-id."
ok "KV: $KV_TITLE ($KV_ID)"

# Queue (efter namn, inget id behövs i config)
$WR queues create "$QUEUE_NAME" >/dev/null 2>&1 || true
ok "Queue: $QUEUE_NAME"

# R2 (efter namn). Återanvänd äldre bucket i befintliga installationer.
R2_NAMES="$($WR r2 bucket list --json 2>/dev/null | jq -r '.[]?.name' || true)"
if ! grep -Fxq "$R2_BUCKET" <<<"$R2_NAMES"; then
  if grep -Fxq "$LEGACY_R2_BUCKET" <<<"$R2_NAMES"; then
    R2_BUCKET="$LEGACY_R2_BUCKET"
    log "  Återanvänder äldre R2-namn: $R2_BUCKET"
  else
    $WR r2 bucket create "$R2_BUCKET" >/dev/null
  fi
fi
ok "R2: $R2_BUCKET"

# ── 5. Patcha wrangler-konfigurationen ─────────────────────────────────────
log "[5/8] Patchar wrangler-konfiguration med dina resurs-ID:n…"
sed -i -E "s|\"database_name\": \"[^\"]*\"|\"database_name\": \"$DB_NAME\"|" "$REPO_DIR/app/wrangler.jsonc"
sed -i -E "s|\"database_id\": \"[^\"]*\"|\"database_id\": \"$DB_ID\"|" "$REPO_DIR/app/wrangler.jsonc"
# KV-id finns bara i app (enda raden med "id": där).
sed -i -E "s|\"id\": \"[a-f0-9]{32}\"|\"id\": \"$KV_ID\"|" "$REPO_DIR/app/wrangler.jsonc"
sed -i -E "s|\"bucket_name\": \"[^\"]*\"|\"bucket_name\": \"$R2_BUCKET\"|" "$REPO_DIR/app/wrangler.jsonc"

# Custom domain: använd din egen, eller ta bort routes-blocket -> *.workers.dev
APP_WR="$REPO_DIR/app/wrangler.jsonc"
if [ -n "$CUSTOM_DOMAIN" ]; then
  sed -i "s|$OWNER_DOMAIN|$CUSTOM_DOMAIN|g" "$APP_WR"
  ok "Custom domain: $CUSTOM_DOMAIN"
else
  if grep -q '"routes"' "$APP_WR"; then
    sed -i '/"routes": \[/,/\],/d' "$APP_WR"
  fi
  ok "Ingen domän satt — deployar till *.workers.dev"
fi

# ── 6. npm install ─────────────────────────────────────────────────────────
log "[6/8] Installerar npm-beroenden…"
( cd "$REPO_DIR/app" && npm install --no-audit --no-fund --silent )
ok "  app/"

# ── 7. Schema + secrets + deploy ───────────────────────────────────────────
log "[7/8] Databas, secrets och deploy…"

if [ "$NEW_DB" = "1" ]; then
  log "  Applicerar schema på ny databas…"
  ( cd "$REPO_DIR/app" && $WR d1 execute "$DB_NAME" --remote --yes --file "$REPO_DIR/infra/schema.sql" >/dev/null )
  ok "  Schema applicerat"
  warn "  Databasen saknar politiker-data. Importera från 'politiker-kontakter'-repot."
else
  ok "  Befintlig databas — hoppar över schema (rör inte din data)"
fi

# Migrations körs bara om de inte redan applicerats (spåras i schema_migrations).
if [ -d "$REPO_DIR/infra/migrations" ]; then
  log "  Applicerar migrations…"
  # Säkerställ att schema_migrations-tabellen finns.
  ( cd "$REPO_DIR/app" && $WR d1 execute "$DB_NAME" --remote --yes --command "CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)" >/dev/null )

  for m in "$REPO_DIR"/infra/migrations/*.sql; do
    [ -e "$m" ] || continue
    filename="$(basename "$m")"

    # Kolla om denna migration redan körts. SELECT:en returnerar sentinelraden
    # MIGRATION_APPLIED bara när en matchande rad finns — texten dyker aldrig upp
    # i kolumnrubriker eller kommando-eko, så grep -Fq blir entydigt (till
    # skillnad från att matcha filnamnet, vars punkter dessutom är regex-metatecken).
    if ( cd "$REPO_DIR/app" && $WR d1 execute "$DB_NAME" --remote --yes --command "SELECT 'MIGRATION_APPLIED' FROM schema_migrations WHERE filename = '$filename'" 2>/dev/null | grep -Fq "MIGRATION_APPLIED" ); then
      continue  # Hoppar över redan applicerade migrations.
    fi

    # Kör migrationen. Äldre migrationer kan sakna "IF NOT EXISTS" och därför
    # misslyckas på databaser som redan har tabellerna men saknar en ifylld
    # schema_migrations (dvs. databaser som fanns före migrationsspårningen).
    # Ett misslyckande här ska inte avbryta hela skriptet — vi registrerar bara
    # migrationen som körd om den faktiskt lyckades.
    if ( cd "$REPO_DIR/app" && $WR d1 execute "$DB_NAME" --remote --yes --file "$m" >/dev/null 2>&1 ); then
      # Registrera att den körts.
      ( cd "$REPO_DIR/app" && $WR d1 execute "$DB_NAME" --remote --yes --command "INSERT INTO schema_migrations (filename, applied_at) VALUES ('$filename', $(date +%s))" >/dev/null )
      ok "  $filename"
    else
      warn "  $filename misslyckades — hoppar över och fortsätter"
    fi
  done
fi

# Sätt en secret om värdet inte är tomt.
put_secret() { # <worker-dir> <namn> <värde>
  local d="$1" name="$2" val="$3"
  [ -n "$val" ] || { warn "  hoppar $name (tom) i $d/"; return; }
  ( cd "$REPO_DIR/$d" && printf '%s' "$val" | $WR secret put "$name" >/dev/null )
  ok "  $d/ $name"
}

# Allt ligger på en Worker sedan app, sender och campaign slogs ihop — en
# uppsättning secrets, en deploy. Kampanj-secreten sätts när de finns; utan
# ANTHROPIC_API_KEY vägrar cron-körningen starta, men fetch och kön går ändå.
put_secret app MAIL_CRED_KEY "$MAIL_CRED_KEY"
put_secret app SYSTEM_SMTP_PASSWORD "$SYSTEM_SMTP_PASSWORD"
put_secret app GITHUB_FEEDBACK_TOKEN "$GITHUB_FEEDBACK_TOKEN"
put_secret app OAUTH_GOOGLE_CLIENT_SECRET "$OAUTH_GOOGLE_CLIENT_SECRET"
put_secret app OAUTH_GITHUB_CLIENT_SECRET "$OAUTH_GITHUB_CLIENT_SECRET"
put_secret app OAUTH_MICROSOFT_CLIENT_SECRET "$OAUTH_MICROSOFT_CLIENT_SECRET"
put_secret app ANTHROPIC_API_KEY "$ANTHROPIC_API_KEY"
put_secret app GMAIL_EMAIL "$GMAIL_EMAIL"
put_secret app GMAIL_PASSWORD "$GMAIL_PASSWORD"
( cd "$REPO_DIR/app" && $WR deploy >/dev/null ) && ok "  Deployade app"

# ── 8. bounce-processor (systemd, valfritt) ────────────────────────────────
log "[8/8] bounce-processor (systemd)…"
if command -v systemctl >/dev/null && [ -n "$GMAIL_EMAIL" ] && [ -n "$GMAIL_PASSWORD" ]; then
  for f in bounce-processor.service bounce-processor.timer; do
    sudo sed \
      -e "s|User=berduf|User=${CURRENT_USER}|g" \
      -e "s|/home/berduf/GitHub/politiker|${REPO_DIR}|g" \
      "$REPO_DIR/infra/$f" | sudo tee "$SERVICE_DIR/$f" > /dev/null
  done
  sudo systemctl daemon-reload
  sudo systemctl enable --now bounce-processor.timer
  systemctl is-active --quiet bounce-processor.timer && ok "  bounce-processor.timer aktiv (kör dagligen 06:00)" || warn "  bounce-processor.timer inte aktiv"
else
  warn "  Hoppar över (kräver systemd + GMAIL_EMAIL/GMAIL_PASSWORD)"
fi

echo
echo "=== Klar ==="
APP_URL="${CUSTOM_DOMAIN:-politiker-app.workers.dev}"
echo "App: https://$APP_URL"
[ "$NEW_DB" = "1" ] && echo "Glöm inte att importera politiker-data (se 'politiker-kontakter')."
echo "Kör om denna fil när som helst för att uppdatera deployen."
