CREATE TABLE IF NOT EXISTS failed_runs (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  request_json TEXT,
  error_code TEXT,
  error_message TEXT,
  error_details TEXT
);

CREATE INDEX IF NOT EXISTS idx_failed_runs_created_at ON failed_runs(created_at);
