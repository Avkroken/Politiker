-- Per-utskick retention för privat brevtext/bilagor.
-- Standard är minsta praktiska fönster: 5 minuter efter terminal status.
ALTER TABLE send_jobs ADD COLUMN content_retention_ms INTEGER NOT NULL DEFAULT 300000;
ALTER TABLE send_jobs ADD COLUMN content_delete_at INTEGER;

-- Befintliga avslutade jobb får samma privacy-first-standard.
UPDATE send_jobs
SET content_delete_at = finished_at + 300000
WHERE finished_at IS NOT NULL
  AND status IN ('done','aborted','cancelled')
  AND content_delete_at IS NULL;

CREATE TRIGGER IF NOT EXISTS trg_send_jobs_content_retention
AFTER UPDATE OF status, finished_at ON send_jobs
WHEN NEW.finished_at IS NOT NULL
 AND NEW.status IN ('done','aborted','cancelled')
BEGIN
  UPDATE send_jobs
  SET content_delete_at = NEW.finished_at +
      CASE NEW.content_retention_ms
        WHEN 300000 THEN 300000
        WHEN 86400000 THEN 86400000
        WHEN 259200000 THEN 259200000
        WHEN 604800000 THEN 604800000
        ELSE 300000
      END
  WHERE id = NEW.id;
END;

-- Retry gör jobbet aktivt igen; raderingsklockan ska då inte löpa.
CREATE TRIGGER IF NOT EXISTS trg_send_jobs_clear_content_retention
AFTER UPDATE OF status ON send_jobs
WHEN NEW.status IN ('pending','sending') AND OLD.status != NEW.status
BEGIN
  UPDATE send_jobs SET content_delete_at = NULL WHERE id = NEW.id;
END;
