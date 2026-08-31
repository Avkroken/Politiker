-- Index för de hetaste D1-frågorna vid hög samtidighet.
-- Politikerdata är lästung och uppdateras batchvis av skraparen, så extra
-- indexkostnad på skrivsidan är avsiktlig för att korta request-/köfrågor.

CREATE INDEX IF NOT EXISTS idx_politicians_area_role
  ON politicians(area_name, role);

CREATE INDEX IF NOT EXISTS idx_politicians_role
  ON politicians(role);

CREATE INDEX IF NOT EXISTS idx_politicians_email_normalized
  ON politicians(lower(trim(email)));

CREATE INDEX IF NOT EXISTS idx_send_jobs_status_created
  ON send_jobs(status, created_at);

CREATE INDEX IF NOT EXISTS idx_send_jobs_account_created
  ON send_jobs(account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_send_jobs_mail_credential
  ON send_jobs(mail_credential_id);

CREATE INDEX IF NOT EXISTS idx_send_log_job_date_status
  ON send_log(send_job_id, sent_at, status);
