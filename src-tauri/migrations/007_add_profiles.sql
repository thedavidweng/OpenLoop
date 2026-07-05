CREATE TABLE IF NOT EXISTS generation_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  model_variant TEXT,
  duration_seconds REAL,
  audio_format TEXT,
  thinking INTEGER,
  inference_steps INTEGER,
  guidance_scale REAL,
  bpm INTEGER,
  key_scale TEXT,
  time_signature TEXT,
  vocal_language TEXT,
  lm_backend TEXT
);

CREATE INDEX IF NOT EXISTS idx_generation_profiles_name ON generation_profiles(name);
