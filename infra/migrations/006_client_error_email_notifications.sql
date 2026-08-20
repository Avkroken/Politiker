-- Spåra vilka automatiska klientfel som faktiskt har lett till en e-postnotis.
-- Dygnstaket ska bara räkna skickade notiser, inte alla lagrade fel.
ALTER TABLE client_errors ADD COLUMN email_notified_at INTEGER;
CREATE INDEX IF NOT EXISTS idx_client_errors_email_notified_at
  ON client_errors (email_notified_at);
