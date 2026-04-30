CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS generations (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  prompt TEXT,
  lyrics TEXT,
  vocal_language TEXT,
  duration_seconds REAL,
  bpm INTEGER,
  key_scale TEXT,
  time_signature TEXT,
  model TEXT,
  lm_model TEXT,
  thinking INTEGER,
  inference_steps INTEGER,
  guidance_scale REAL,
  use_random_seed INTEGER,
  seed TEXT,
  audio_format TEXT,
  output_path TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  error_message TEXT,
  generation_info TEXT
);

CREATE TABLE IF NOT EXISTS backend_events (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  level TEXT NOT NULL,
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata_json TEXT
);

CREATE TABLE IF NOT EXISTS active_generation_tasks (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  request_json TEXT NOT NULL,
  variation_index INTEGER NOT NULL,
  variation_total INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
