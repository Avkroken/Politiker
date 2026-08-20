# PINNAD MED FLIT — undantag från repots huvudregel, och tvärtemot vad som
# stod här förut. Resonemanget var att en flytande tagg undviker att låsa
# OS-generationen. Mätningen säger något annat: Microsoft pekar fortfarande
# `:latest` på Ubuntu 22.04. Trivy 2026-08-17 gav 856 åtgärdbara CVE:er för
# `:latest` (python3.10, libssl3, gstreamer) mot 39 för `v1.62.0-noble`.
# Den flytande taggen levererade alltså precis det den valdes för att undvika.
#
# Dependabot bumpar `v1.62.0-noble` inom samma taggfamilj när en ny kompatibel
# Playwright/Noble-image publiceras. Vad den INTE gör är att flytta mellan
# Ubuntu-generationer: när imagen får en 26.04-variant måste suffixet bytas för
# hand. Kontrollera det vid nästa guldstandardavstämning, och jämför då om
# `:latest` hunnit ikapp — då kan pinnen släppas igen.
#
# Playwright-versionen behöver inte matcha imagen: entrypoint.sh kör
# `playwright install chromium --with-deps` vid start, så webbläsarna hämtas
# för den version pip faktiskt installerat.
FROM mcr.microsoft.com/playwright/python:v1.62.0-noble
WORKDIR /app

# Basimagen är en ögonblicksbild och kan därför innehålla paket som hunnit få
# säkerhetsfixar efter att Microsoft publicerade taggen. Trivy kör med
# ignore-unfixed=true, så kvarvarande OS-fynd har en tillgänglig fix. Installera
# Nobles aktuella uppdateringar vid varje imagebuild i stället för att pinna
# dussintals transitiva apt-paket en och en.
RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get upgrade -y \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY scraper.py politiker_common.py regioner.json ./
COPY entrypoint.sh .
ENTRYPOINT ["/app/entrypoint.sh"]
