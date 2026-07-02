-- Royal Imperial AI v1.0.84
-- Panel Admin para revisar enlaces TikTok del pre-lanzamiento.
-- No requiere cambios estructurales. Solo asegura la tabla si no existe.

CREATE TABLE IF NOT EXISTS prelaunch_tiktok_submissions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tiktok_url TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  reward_usdt NUMERIC(38,18) NOT NULL DEFAULT 4,
  admin_note TEXT,
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  RAISE NOTICE 'v1.0.84: Panel Admin de Pre-lanzamiento/TikTok listo.';
END $$;
