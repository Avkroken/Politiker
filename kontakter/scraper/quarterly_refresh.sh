#!/bin/bash
# Kvartalsvis uppdatering av hela kontaktlistan: politiker, kyrkovalda och
# redaktionella mediekontakter. Synkar till D1 och uppdaterar parti där relevant.
#
# Första riktiga körning ska ske EFTER valet 2026-09 (ny mandatperiod) —
# se crontab-kommentar. Körs sedan var 3:e månad.
set -e
cd "$(dirname "$0")"

set -a
source ~/.appdata/.config/.env
set +a

echo "=== $(date -Iseconds) Startar kvartalsvis uppdatering ==="

echo "--- Skrapar kommun/region (Playwright/Docker) ---"
cd ..
docker compose up --build --abort-on-container-exit --exit-code-from scraper
cd scraper

echo "--- Synkar kommun/region till D1 ---"
python3 sync_to_d1.py

echo "--- Hämtar EU-parlamentariker (alla 27 länder) ---"
python3 fetch_eu_meps.py

echo "--- Hämtar riksdagens nuvarande ledamöter ---"
python3 fetch_riksdagen_members.py

echo "--- Synkar regeringens departement ---"
python3 sync_regeringen.py

echo "--- Hämtar Svenska kyrkans kyrkovalda (kyrkostyrelse + Uppsala stift) ---"
python3 fetch_kyrka.py

echo "--- Synkar fem stora nyhetsorganisationers redaktionella kontakter ---"
python3 fetch_media.py

echo "--- Fyller i parti för kommun/region via Valmyndigheten ---"
python3 sync_party_from_val.py

echo "=== $(date -Iseconds) Klart ==="
