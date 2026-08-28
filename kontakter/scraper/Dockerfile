# PINNAD MED FLIT — undantag från repots huvudregel. Microsoft pekar fortfarande
# `:latest` på Ubuntu 22.04, medan `v1.62.0-noble` gav drastiskt färre fixbara
# Trivy-fynd. Dependabot uppdaterar taggen inom Noble-familjen; byte till nästa
# Ubuntu-generation görs separat när en sådan Playwright-image finns.
FROM mcr.microsoft.com/playwright/python:v1.62.0-noble
WORKDIR /app

# Basimagen är en ögonblicksbild. Ta alltid in aktuella Noble-fixar vid build.
# python3-venv behövs eftersom Noble följer PEP 668 och blockerar system-wide pip.
RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get upgrade -y \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends python3-venv \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
ENV VIRTUAL_ENV=/opt/venv
ENV PATH="${VIRTUAL_ENV}/bin:${PATH}"
# Installera appens patchade runtime-beroenden isolerat från OS-Python. Runtime
# behöver inte pip, och Playwright-basimagen lämnar dessutom en virtualenv
# seed-cache med separata kopior av pip och dess vendorerade paket. De kopiorna
# är inte importerbara runtime-beroenden men inventeras av Trivy, så pip och
# seed-cacher tas bort efter installationen.
RUN python3 -m venv "$VIRTUAL_ENV" \
    && "$VIRTUAL_ENV/bin/python" -m pip install --no-cache-dir -r requirements.txt \
    && "$VIRTUAL_ENV/bin/python" -m pip uninstall --yes pip \
    && rm -rf /root/.cache/virtualenv /root/.cache/pip

COPY scraper.py politiker_common.py regioner.json ./
COPY entrypoint.sh .
ENTRYPOINT ["/app/entrypoint.sh"]
