-- Royal Imperial AI v1.0.98
-- Límites diarios de canje por nivel, reinicio 00:00 GMT-5.

CREATE TABLE IF NOT EXISTS redeem_daily_limit_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  standard_daily_limit INTEGER NOT NULL DEFAULT 1 CHECK (standard_daily_limit > 0),
  premium_daily_limit INTEGER NOT NULL DEFAULT 3 CHECK (premium_daily_limit > 0),
  premium_from_level INTEGER NOT NULL DEFAULT 3 CHECK (premium_from_level BETWEEN 1 AND 8),
  timezone VARCHAR(80) NOT NULL DEFAULT 'America/Lima',
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO redeem_daily_limit_config(
  id,
  is_active,
  standard_daily_limit,
  premium_daily_limit,
  premium_from_level,
  timezone
)
VALUES (1, TRUE, 1, 3, 3, 'America/Lima')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE redeem_code_redemptions
ADD COLUMN IF NOT EXISTS redeemed_day DATE;

UPDATE redeem_code_redemptions
SET redeemed_day = ((created_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Lima')::date
WHERE redeemed_day IS NULL;

ALTER TABLE redeem_code_redemptions
ALTER COLUMN redeemed_day SET DEFAULT ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date);

CREATE INDEX IF NOT EXISTS idx_redeem_redemptions_user_day
ON redeem_code_redemptions(user_id, redeemed_day);
