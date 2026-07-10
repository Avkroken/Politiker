FROM mcr.microsoft.com/playwright/python:v1.61.0-jammy@sha256:108b33fc1c785c056665b04c320a612526503b0b081209eea2e1ec89e3b69a8f
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY scraper.py politiker_common.py regioner.json ./
COPY entrypoint.sh .
ENTRYPOINT ["/app/entrypoint.sh"]
