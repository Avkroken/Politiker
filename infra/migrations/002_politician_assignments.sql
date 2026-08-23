-- Separata politiska uppdrag/nämnder per person.
-- En politiker kan ha flera uppdrag i samma kommun/region, därför ligger de
-- inte i politicians.role.
CREATE TABLE politician_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  politician_id TEXT NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
  area_name TEXT NOT NULL,
  body TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT '',
  source TEXT,
  last_scraped_at INTEGER NOT NULL,
  UNIQUE(politician_id, body, role)
);

CREATE INDEX idx_politician_assignments_politician
  ON politician_assignments(politician_id);
CREATE INDEX idx_politician_assignments_area_body
  ON politician_assignments(area_name, body);
