-- Redigerbar utskickstakt per användarutskick. NULL betyder att bara kontots
-- och mailleverantörens ordinarie dygnstak begränsar utskicket.
ALTER TABLE send_jobs ADD COLUMN daily_limit INTEGER;
ALTER TABLE send_jobs ADD COLUMN next_daily_limit INTEGER;
ALTER TABLE send_jobs ADD COLUMN limit_switch_at INTEGER;
