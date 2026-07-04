FROM mcr.microsoft.com/playwright/python:v1.60.0-jammy@sha256:aaa8048c7a7c414fab6ad809469eb35f13bbf5093038113eef851b3c4814ad77
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY scraper.py politiker_common.py regioner.json ./
COPY entrypoint.sh .
ENTRYPOINT ["/app/entrypoint.sh"]
