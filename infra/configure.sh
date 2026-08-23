#!/usr/bin/env bash
# Guidat konfigurationssteg för en ny installation.
# Skapar/uppdaterar infra/.env utan att skriva hemligheter till Git.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$REPO_DIR/infra/.env"
EXAMPLE_FILE="$REPO_DIR/infra/.env.example"

say() { printf '%s\n' "$*"; }
ask() {
  local key="$1" prompt="$2" default="${3:-}" secret="${4:-0}" current=""
  if [ -f "$ENV_FILE" ]; then
    current=$(grep -m1 "^${key}=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- || true)
  fi
  [ -n "$current" ] && default="$current"
  local value
  if [ "$secret" = "1" ]; then
    if [ -n "$default" ]; then
      read -r -s -p "$prompt [behåll befintligt]: " value; echo
      [ -z "$value" ] && return 0
    else
      read -r -s -p "$prompt: " value; echo
    fi
  else
    if [ -n "$default" ]; then
      read -r -p "$prompt [$default]: " value
      value="${value:-$default}"
    else
      read -r -p "$prompt: " value
    fi
  fi
  python3 - "$ENV_FILE" "$key" "$value" <<'PY'
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

if [ ! -f "$ENV_FILE" ]; then
  install -m 600 "$EXAMPLE_FILE" "$ENV_FILE"
fi
chmod 600 "$ENV_FILE"

say "=== Politikerkontakt – konfiguration ==="
say "Enter accepterar standardvärdet. Valfria integrationer kan lämnas tomma."
say ""
ask CUSTOM_DOMAIN "Egen domän (tom = workers.dev)"
ask SYSTEM_SMTP_HOST "SMTP-server för systemmail"
ask SYSTEM_SMTP_PORT "SMTP-port" "587"
ask SYSTEM_SMTP_USER "SMTP-användare"
ask SYSTEM_FROM_ADDRESS "Avsändaradress för systemmail"
ask FEEDBACK_NOTIFY_EMAIL "Adress som tar emot feedbacknotiser"
ask SYSTEM_SMTP_PASSWORD "SMTP-lösenord/app-lösenord" "" 1

say ""
say "OAuth är valfritt. Lämna tomt om endast e-post/lösenord ska användas."
ask OAUTH_GOOGLE_CLIENT_ID "Google OAuth Client ID"
ask OAUTH_GOOGLE_CLIENT_SECRET "Google OAuth Client Secret" "" 1
ask OAUTH_GITHUB_CLIENT_ID "GitHub OAuth Client ID"
ask OAUTH_GITHUB_CLIENT_SECRET "GitHub OAuth Client Secret" "" 1
ask OAUTH_MICROSOFT_CLIENT_ID "Microsoft OAuth Client ID"
ask OAUTH_MICROSOFT_CLIENT_SECRET "Microsoft OAuth Client Secret" "" 1

say ""
say "Bounce-hantering är valfri."
ask GMAIL_EMAIL "Gmail-adress för bounce-processor"
ask GMAIL_PASSWORD "Gmail app-lösenord" "" 1

if ! grep -q '^MAIL_CRED_KEY=.' "$ENV_FILE"; then
  key=$(openssl rand -base64 32)
  python3 - "$ENV_FILE" "$key" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1]); value=sys.argv[2]
lines=p.read_text().splitlines(); out=[]; found=False
for line in lines:
    if line.startswith('MAIL_CRED_KEY='):
        out.append('MAIL_CRED_KEY='+value); found=True
    else: out.append(line)
if not found: out.append('MAIL_CRED_KEY='+value)
p.write_text('\n'.join(out)+'\n')
PY
  say "Genererade MAIL_CRED_KEY automatiskt."
fi

say ""
say "Konfiguration sparad i infra/.env (git-ignorerad, mode 600)."
say "Kör nu: bash infra/setup.sh"
