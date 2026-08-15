# Flytande tagg med flit: en pinnad version låser också OS-generationen,
# eftersom den står i taggnamnet (v1.62.0-jammy vs v1.62.0-noble). Dependabot
# rör sig aldrig mellan taggfamiljer, så en pinnad tagg sitter kvar på ett
# gammalt Ubuntu tills någon byter för hand — den här satt på 22.04 långt
# efter att 24.04 fanns.
#
# Playwright-versionen behöver inte matcha imagen: entrypoint.sh kör
# `playwright install chromium --with-deps` vid start, så webbläsarna hämtas
# för den version pip faktiskt installerat.
FROM mcr.microsoft.com/playwright/python:latest
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY scraper.py politiker_common.py regioner.json ./
COPY entrypoint.sh .
ENTRYPOINT ["/app/entrypoint.sh"]
