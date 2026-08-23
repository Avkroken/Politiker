#!/usr/bin/env bash
# Provisionera och deploya Politikerkontakt.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$REPO_DIR/infra/.env"
SERVICE_DIR="/etc/systemd/system"
CURRENT_USER="$(id -un)"
WR="npx --yes wrangler"
DB_NAME="politiker-eu"
KV_TITLE="politiker_sessions"
QUEUE_NAME="politiker-send-jobs"
DLQ_NAME="politiker-send-jobs-dlq"
WORKER_NAME="politiker"
R2_BUCKET="politiker-attachments"

log()  { printf '\033[1;34m›\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m✓\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }
_get() { grep -m1 "^$1=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- || true; }
_set() {
  local k="$1" v="$2"
  python3 - "$ENV_FILE" "$k" "$v" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1]); key=sys.argv[2]; value=sys.argv[3]
lines=p.read_text().splitlines() if p.exists() else []
out=[]; found=False
for line in lines:
    if line.startswith(key+'='):
        out.append(f'{key}={value}'); found=True
    else: out.append(line)
if not found: out.append(f'{key}={value}')
p.write_text('\n'.join(out)+'\n')
PY
}

cd "$REPO_DIR"
echo "=== Politikerkontakt setup ==="

log "[1/8] Kontrollerar beroenden…"
command -v node >/dev/null || die "Node.js krävs. Se docs/SETUP.md."
command -v npm >/dev/null || die "npm krävs."
command -v openssl >/dev/null || die "openssl krävs."
command -v python3 >/dev/null || die "python3 krävs."
if ! command -v jq >/dev/null; then
  if command -v apt-get >/dev/null; then sudo apt-get update -qq && sudo apt-get install -y jq
  else die "jq saknas. Installera jq och kör om."; fi
fi
ok "Beroenden OK"

log "[2/8] Lokal konfiguration…"
if [ ! -f "$ENV_FILE" ]; then
  warn "infra/.env saknas. Startar den guidade konfigureringen."
  bash "$REPO_DIR/infra/configure.sh"
fi
chmod 600 "$ENV_FILE"
if [ -z "$(_get MAIL_CRED_KEY)" ]; then _set MAIL_CRED_KEY "$(openssl rand -base64 32)"; fi

CUSTOM_DOMAIN="$(_get CUSTOM_DOMAIN)"
APP_BASE_URL="$(_get APP_BASE_URL)"
SYSTEM_SMTP_HOST="$(_get SYSTEM_SMTP_HOST)"
SYSTEM_SMTP_PORT="$(_get SYSTEM_SMTP_PORT)"; SYSTEM_SMTP_PORT="${SYSTEM_SMTP_PORT:-587}"
SYSTEM_SMTP_USER="$(_get SYSTEM_SMTP_USER)"
SYSTEM_SMTP_PASSWORD="$(_get SYSTEM_SMTP_PASSWORD)"
SYSTEM_FROM_ADDRESS="$(_get SYSTEM_FROM_ADDRESS)"
FEEDBACK_NOTIFY_EMAIL="$(_get FEEDBACK_NOTIFY_EMAIL)"
MAIL_CRED_KEY="$(_get MAIL_CRED_KEY)"
GMAIL_EMAIL="$(_get GMAIL_EMAIL)"
GMAIL_PASSWORD="$(_get GMAIL_PASSWORD)"
OAUTH_GOOGLE_CLIENT_ID="$(_get OAUTH_GOOGLE_CLIENT_ID)"
OAUTH_GOOGLE_CLIENT_SECRET="$(_get OAUTH_GOOGLE_CLIENT_SECRET)"
OAUTH_GITHUB_CLIENT_ID="$(_get OAUTH_GITHUB_CLIENT_ID)"
OAUTH_GITHUB_CLIENT_SECRET="$(_get OAUTH_GITHUB_CLIENT_SECRET)"
OAUTH_MICROSOFT_CLIENT_ID="$(_get OAUTH_MICROSOFT_CLIENT_ID)"
OAUTH_MICROSOFT_CLIENT_SECRET="$(_get OAUTH_MICROSOFT_CLIENT_SECRET)"

[ -n "$SYSTEM_SMTP_HOST" ] || warn "Systemmail är inte komplett konfigurerat. Konto kan skapas först när SMTP är konfigurerat."
[ -n "$SYSTEM_SMTP_USER" ] || warn "SYSTEM_SMTP_USER saknas."
[ -n "$SYSTEM_SMTP_PASSWORD" ] || warn "SYSTEM_SMTP_PASSWORD saknas."
ok "Konfiguration inläst"

log "[3/8] Cloudflare-inloggning…"
if ! $WR whoami >/dev/null 2>&1; then $WR login; fi
$WR whoami >/dev/null || die "Wrangler kunde inte logga in på Cloudflare."
ok "Cloudflare-inloggning OK"

log "[4/8] Provisionerar Cloudflare-resurser…"
DB_ID="$($WR d1 list --json 2>/dev/null | jq -r ".[] | select(.name==\"$DB_NAME\") | (.uuid // .database_id // .id)" | head -1)"
NEW_DB=0
if [ -z "$DB_ID" ] || [ "$DB_ID" = "null" ]; then
  $WR d1 create "$DB_NAME" --jurisdiction=eu >/dev/null
  DB_ID="$($WR d1 list --json | jq -r ".[] | select(.name==\"$DB_NAME\") | (.uuid // .database_id // .id)" | head -1)"
  NEW_DB=1
fi
[ -n "$DB_ID" ] && [ "$DB_ID" != "null" ] || die "Kunde inte fastställa D1 database_id."

KV_ID="$($WR kv namespace list 2>/dev/null | jq -r ".[] | select(.title==\"$KV_TITLE\") | .id" | head -1)"
if [ -z "$KV_ID" ] || [ "$KV_ID" = "null" ]; then
  $WR kv namespace create "$KV_TITLE" >/dev/null
  KV_ID="$($WR kv namespace list | jq -r ".[] | select(.title==\"$KV_TITLE\") | .id" | head -1)"
fi
[ -n "$KV_ID" ] || die "Kunde inte fastställa KV namespace-id."

$WR queues create "$QUEUE_NAME" >/dev/null 2>&1 || true
$WR queues create "$DLQ_NAME" >/dev/null 2>&1 || true
R2_NAMES="$($WR r2 bucket list --json 2>/dev/null | jq -r '.[]?.name' || true)"
grep -Fxq "$R2_BUCKET" <<<"$R2_NAMES" || $WR r2 bucket create "$R2_BUCKET" >/dev/null
ok "D1, KV, Queues och R2 klara"

log "[5/8] Genererar Wrangler-konfiguration…"
if [ -z "$APP_BASE_URL" ]; then
  if [ -n "$CUSTOM_DOMAIN" ]; then APP_BASE_URL="https://$CUSTOM_DOMAIN"; else APP_BASE_URL="https://$WORKER_NAME.workers.dev"; fi
  _set APP_BASE_URL "$APP_BASE_URL"
fi
python3 - "$REPO_DIR/app/wrangler.jsonc" "$DB_ID" "$KV_ID" "$CUSTOM_DOMAIN" "$APP_BASE_URL" \
  "$SYSTEM_SMTP_HOST" "$SYSTEM_SMTP_PORT" "$SYSTEM_SMTP_USER" "$SYSTEM_FROM_ADDRESS" "$FEEDBACK_NOTIFY_EMAIL" \
  "$OAUTH_GOOGLE_CLIENT_ID" "$OAUTH_GITHUB_CLIENT_ID" "$OAUTH_MICROSOFT_CLIENT_ID" <<'PY'
import json,sys
p=sys.argv[1]
(db_id,kv_id,domain,base_url,smtp_host,smtp_port,smtp_user,from_addr,feedback,google_id,github_id,microsoft_id)=sys.argv[2:]
with open(p,encoding='utf-8') as f: cfg=json.load(f)
cfg['name']='politiker'
cfg['d1_databases']=[{'binding':'DB','database_name':'politiker-eu','database_id':db_id}]
cfg['kv_namespaces']=[{'binding':'SESSIONS','id':kv_id}]
cfg['queues']={'producers':[{'queue':'politiker-send-jobs','binding':'SEND_QUEUE'}], 'consumers':[{'queue':'politiker-send-jobs','max_batch_size':10,'max_retries':10,'max_concurrency':5,'dead_letter_queue':'politiker-send-jobs-dlq'}]}
cfg['r2_buckets']=[{'binding':'ATTACHMENTS','bucket_name':'politiker-attachments'}]
if domain:
    cfg['workers_dev']=False; cfg['routes']=[{'pattern':domain,'custom_domain':True}]
else:
    cfg['workers_dev']=True; cfg.pop('routes',None)
# Tail-consumern är produktionsspecifik och ska inte krävas av en ny installation.
cfg.pop('tail_consumers',None)
vars=cfg.setdefault('vars',{})
for k,v in {
 'APP_BASE_URL':base_url,'SYSTEM_SMTP_HOST':smtp_host,'SYSTEM_SMTP_PORT':smtp_port,
 'SYSTEM_SMTP_USER':smtp_user,'SYSTEM_FROM_ADDRESS':from_addr,'FEEDBACK_NOTIFY_EMAIL':feedback,
 'OAUTH_GOOGLE_CLIENT_ID':google_id,'OAUTH_GITHUB_CLIENT_ID':github_id,'OAUTH_MICROSOFT_CLIENT_ID':microsoft_id,
}.items():
    if v: vars[k]=v
    else: vars.pop(k,None)
if from_addr: cfg['send_email']=[{'name':'EMAIL','allowed_sender_addresses':[from_addr]}]
else: cfg.pop('send_email',None)
with open(p,'w',encoding='utf-8') as f: json.dump(cfg,f,ensure_ascii=False,indent=2); f.write('\n')
PY
ok "Appadress: $APP_BASE_URL"

log "[6/8] Installerar npm-beroenden…"
( cd "$REPO_DIR/app" && npm install --no-audit --no-fund --silent )
ok "npm klart"

log "[7/8] Databas, Worker-secrets och deploy…"
if [ "$NEW_DB" = "1" ]; then
  ( cd "$REPO_DIR/app" && $WR d1 execute "$DB_NAME" --remote --yes --file "$REPO_DIR/infra/schema.sql" >/dev/null )
else
  bash "$REPO_DIR/infra/apply-migrations.sh"
fi
put_secret() {
  local name="$1" val="$2"
  [ -n "$val" ] || return 0
  ( cd "$REPO_DIR/app" && printf '%s' "$val" | $WR secret put "$name" >/dev/null )
}
put_secret MAIL_CRED_KEY "$MAIL_CRED_KEY"
put_secret SYSTEM_SMTP_PASSWORD "$SYSTEM_SMTP_PASSWORD"
put_secret OAUTH_GOOGLE_CLIENT_SECRET "$OAUTH_GOOGLE_CLIENT_SECRET"
put_secret OAUTH_GITHUB_CLIENT_SECRET "$OAUTH_GITHUB_CLIENT_SECRET"
put_secret OAUTH_MICROSOFT_CLIENT_SECRET "$OAUTH_MICROSOFT_CLIENT_SECRET"
( cd "$REPO_DIR/app" && $WR deploy >/dev/null )
ok "Worker deployad"

log "[8/8] Valfri bounce-processor…"
if command -v systemctl >/dev/null && [ -n "$GMAIL_EMAIL" ] && [ -n "$GMAIL_PASSWORD" ] && [ -n "$(_get CLOUDFLARE_API_TOKEN_POLITIKER)" ]; then
  for f in bounce-processor.service bounce-processor.timer; do
    sudo sed -e "s|User=berduf|User=${CURRENT_USER}|g" -e "s|/home/berduf/GitHub/politiker|${REPO_DIR}|g" "$REPO_DIR/infra/$f" | sudo tee "$SERVICE_DIR/$f" >/dev/null
  done
  sudo systemctl daemon-reload
  sudo systemctl enable --now bounce-processor.timer
  ok "bounce-processor.timer aktiverad"
else
  warn "Bounce-processor hoppades över (valfri; se docs/SETUP.md)."
fi

echo
echo "=== Klar ==="
echo "App: $APP_BASE_URL"
[ "$NEW_DB" = "1" ] && echo "Databasen är ny. Se docs/SETUP.md för kontaktdata/import."
echo "Konfiguration: infra/.env"
