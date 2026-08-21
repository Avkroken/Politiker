-- Reparera installationer där 005_daily_api_usage.sql felaktigt registrerades
-- som historisk baslinje trots att tabellen inte fanns i D1.
CREATE TABLE IF NOT EXISTS daily_api_usage (
  date       TEXT PRIMARY KEY,  -- "YYYY-MM-DD" UTC
  call_count INTEGER NOT NULL DEFAULT 0
);
