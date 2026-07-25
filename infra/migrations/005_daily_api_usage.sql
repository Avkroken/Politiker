-- Spårar dagliga Anthropic API-anrop per UTC-dag för att hålla oss
-- inom det konfigurerade månadslimitet.
CREATE TABLE IF NOT EXISTS daily_api_usage (
  date       TEXT PRIMARY KEY,  -- "YYYY-MM-DD" UTC
  call_count INTEGER NOT NULL DEFAULT 0
);