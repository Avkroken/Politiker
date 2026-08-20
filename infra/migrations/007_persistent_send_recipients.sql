-- Låt stora användarutskick fortsätta över flera dygn utan externa skript.
CREATE TABLE IF NOT EXISTS send_job_recipients (
  send_job_id TEXT NOT NULL REFERENCES send_jobs(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL COLLATE NOCASE,
  recipient_name TEXT NOT NULL,
  subject TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  queued_at INTEGER,
  finished_at INTEGER,
  error TEXT,
  PRIMARY KEY (send_job_id, recipient_email)
);

CREATE INDEX IF NOT EXISTS idx_send_job_recipients_pending
  ON send_job_recipients(send_job_id, status);
CREATE INDEX IF NOT EXISTS idx_send_job_recipients_queued
  ON send_job_recipients(status, queued_at);
