CREATE INDEX IF NOT EXISTS idx_generations_history
    ON generations (status, is_favorite DESC, created_at DESC);