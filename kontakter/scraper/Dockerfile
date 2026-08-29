FROM mcr.microsoft.com/playwright/python:v1.62.0-noble

WORKDIR /app

# Håll basimagen patchad och använd distro-paketet för att skapa venv. Paketet
# drar in bootstrap-wheels för pip/setuptools; de behövs bara när venv skapas
# och tas därför bort igen efter dependency-installationen.
RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get upgrade -y \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends python3-venv

ENV VIRTUAL_ENV=/opt/venv
ENV PATH="${VIRTUAL_ENV}/bin:${PATH}"

COPY requirements.txt .
RUN python3 -m venv "${VIRTUAL_ENV}" \
    && "${VIRTUAL_ENV}/bin/python" -m pip install --no-cache-dir -r requirements.txt \
    && "${VIRTUAL_ENV}/bin/python" -m pip uninstall --yes pip \
    && apt-get purge -y python3-venv python3.12-venv python3-pip-whl python3-setuptools-whl \
    && rm -rf /var/lib/apt/lists/* /root/.cache/virtualenv /root/.cache/pip \
    && "${VIRTUAL_ENV}/bin/python" -c "import importlib.metadata as m; print('setuptools', m.version('setuptools'))"

COPY scraper.py politiker_common.py regioner.json ./
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

ENTRYPOINT ["./entrypoint.sh"]
