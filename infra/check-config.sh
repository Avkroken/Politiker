#!/usr/bin/env bash
set -euo pipefail
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$REPO_DIR/infra/.env"

[ -f "$ENV_FILE" ] || { echo "SAKNAS: infra/.env — kör bash infra/configure.sh"; exit 1; }
getv(){ grep -m1 "^$1=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- || true; }

errors=0
warn(){ echo "VALFRITT/SAKNAS: $*"; }
req(){ local v; v=$(getv "$1"); if [ -z "$v" ]; then echo "KRÄVS: $1"; errors=$((errors+1)); else echo "OK: $1"; fi; }
pair(){ local a b; a=$(getv "$1"); b=$(getv "$2"); if [ -n "$a" ] && [ -z "$b" ]; then echo "OFULLSTÄNDIGT: $1 är satt men $2 saknas"; errors=$((errors+1)); elif [ -z "$a" ] && [ -n "$b" ]; then echo "OFULLSTÄNDIGT: $2 är satt men $1 saknas"; errors=$((errors+1)); elif [ -n "$a" ]; then echo "OK: $1 + $2"; fi; }

echo "=== Grundkonfiguration ==="
req MAIL_CRED_KEY
req SYSTEM_SMTP_HOST
req SYSTEM_SMTP_PORT
req SYSTEM_SMTP_USER
req SYSTEM_SMTP_PASSWORD
req SYSTEM_FROM_ADDRESS
req FEEDBACK_NOTIFY_EMAIL

echo
echo "=== Valfria integrationer ==="
pair OAUTH_GOOGLE_CLIENT_ID OAUTH_GOOGLE_CLIENT_SECRET
pair OAUTH_GITHUB_CLIENT_ID OAUTH_GITHUB_CLIENT_SECRET
pair OAUTH_MICROSOFT_CLIENT_ID OAUTH_MICROSOFT_CLIENT_SECRET
pair GMAIL_EMAIL GMAIL_PASSWORD
if [ -n "$(getv GMAIL_EMAIL)" ] && [ -z "$(getv CLOUDFLARE_API_TOKEN_POLITIKER)" ]; then
  warn "CLOUDFLARE_API_TOKEN_POLITIKER behövs om bounce-processorn ska skriva till D1"
fi

if [ "$errors" -gt 0 ]; then
  echo; echo "$errors konfigurationsfel måste rättas."
  exit 1
fi
echo; echo "Konfigurationen är sammanhängande."
