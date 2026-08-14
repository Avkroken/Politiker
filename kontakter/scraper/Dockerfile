FROM mcr.microsoft.com/playwright/python:v1.62.0-jammy@sha256:017530b316b85f71b3f0989310393a9095253820e77e9ed94aa3b7d7eb5ecd16
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY scraper.py politiker_common.py regioner.json ./
COPY entrypoint.sh .
ENTRYPOINT ["/app/entrypoint.sh"]
