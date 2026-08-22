-- Mail credentials kan inte hårdraderas så länge send_jobs historiskt refererar
-- till dem. Behåll metadata-raden för referensintegritet men radera hemligheter
-- och göm credentialen från nya utskick när användaren tar bort den.
ALTER TABLE mail_credentials ADD COLUMN revoked_at INTEGER;

CREATE INDEX IF NOT EXISTS idx_mail_credentials_account_active
  ON mail_credentials(account_id, revoked_at, created_at);
