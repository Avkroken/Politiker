FROM mcr.microsoft.com/playwright/python:v1.62.0-noble

WORKDIR /app

# Håll basimagen patchad. Playwright-imagen innehåller även globala Python-paket
# som Trivy inventerar trots att applikationen kör i /opt/venv. Uppgradera de
# säkerhetsrelevanta baskopiorna explicit med PEP 668-undantaget och ta bort
# global pip; runtime använder endast venv-miljön nedan.
RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get upgrade -y \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends python3-venv \
    && python3 -m pip install --break-system-packages --no-cache-dir \
         'idna>=3.19' 'setuptools>=84.0.0' 'msgpack>=1.2.1' \
    && python3 -c "import importlib.metadata as m; print('base idna', m.version('idna')); print('base setuptools', m.version('setuptools')); print('base msgpack', m.version('msgpack'))" \
    && python3 -m pip uninstall --break-system-packages --yes pip

ENV VIRTUAL_ENV=/opt/venv
ENV PATH="${VIRTUAL_ENV}/bin:${PATH}"

COPY requirements.txt .
RUN python3 -m venv "${VIRTUAL_ENV}" \
    && "${VIRTUAL_ENV}/bin/python" -m pip install --no-cache-dir -r requirements.txt \
    && "${VIRTUAL_ENV}/bin/python" -m pip uninstall --yes pip \
    && apt-get purge -y python3-venv python3.12-venv python3-pip-whl python3-setuptools-whl \
    && rm -rf /var/lib/apt/lists/* /root/.cache/virtualenv /root/.cache/pip \
    && "${VIRTUAL_ENV}/bin/python" -c "import importlib.metadata as m; print('venv idna', m.version('idna')); print('venv setuptools', m.version('setuptools')); print('venv msgpack', m.version('msgpack'))"

COPY scraper.py politiker_common.py regioner.json ./
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

ENTRYPOINT ["./entrypoint.sh"]
