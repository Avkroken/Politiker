# PINNAD MED FLIT — undantag från repots huvudregel. Microsoft pekar fortfarande
# `:latest` på Ubuntu 22.04, medan `v1.62.0-noble` gav drastiskt färre fixbara
# Trivy-fynd. Dependabot uppdaterar taggen inom Noble-familjen; byte till nästa
# Ubuntu-generation görs separat när en sådan Playwright-image finns.
FROM mcr.microsoft.com/playwright/python:v1.62.0-noble
WORKDIR /app

# Basimagen är en ögonblicksbild. Ta alltid in aktuella Noble-fixar vid build.
RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get upgrade -y \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
# Installera appens patchade runtime-beroenden. Runtime behöver inte pip, och
# Playwright-basimagen lämnar dessutom en virtualenv seed-cache med en separat
# kopia av pip och dess vendorerade paket (bl.a. äldre msgpack/setuptools).
# De kopiorna är inte importerbara runtime-beroenden men inventeras av Trivy,
# så både pip och just seed-cachen tas bort efter installationen.
RUN python -m pip install --no-cache-dir -r requirements.txt \
    && python -m pip uninstall --yes pip \
    && rm -rf /root/.cache/virtualenv /root/.cache/pip

COPY scraper.py politiker_common.py regioner.json ./
COPY entrypoint.sh .
ENTRYPOINT ["/app/entrypoint.sh"]
