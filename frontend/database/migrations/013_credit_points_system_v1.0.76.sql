-- Royal Imperial AI v1.0.76
-- Sistema de puntos de crédito:
-- 50 base al crear cuenta.
-- 60 datos de contacto completos.
-- 70 cuenta de retiro registrada.
-- 80 recarga realizada.
-- 90 retiro habilitado por admin.
-- +1 al invitador por cada invitado validado con retiros habilitados.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS credit_points INTEGER DEFAULT 50 NOT NULL;

ALTER TABLE users
  ALTER COLUMN credit_points SET DEFAULT 50;

CREATE TABLE IF NOT EXISTS credit_point_events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type VARCHAR(60) NOT NULL,
  event_key VARCHAR(160),
  operation VARCHAR(30) NOT NULL,
  points_delta INTEGER NOT NULL DEFAULT 0,
  previous_points INTEGER NOT NULL DEFAULT 0,
  next_points INTEGER NOT NULL DEFAULT 0,
  reason TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_point_events_user_key
ON credit_point_events(user_id, event_key)
WHERE event_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_credit_point_events_user_created
ON credit_point_events(user_id, created_at DESC);

WITH computed AS (
  SELECT
    u.id,
    (
      CASE
        WHEN COALESCE(u.withdraw_enabled,false) = true THEN 90
        WHEN EXISTS (
          SELECT 1
          FROM deposits d
          WHERE d.user_id = u.id
            AND d.status = 'confirmed'
            AND COALESCE(d.amount_usdt,0) > 0
        )
        OR EXISTS (
          SELECT 1
          FROM account_ledger al
          WHERE al.user_id = u.id
            AND al.direction = 'credit'
            AND al.balance_type IN ('recharge','investment')
            AND al.type IN ('manual_recharge','manual_investment','deposit','deposit_confirmed','admin_balance_adjustment')
            AND COALESCE(al.amount_usdt,0) > 0
        ) THEN 80
        WHEN EXISTS (
          SELECT 1
          FROM user_withdrawal_accounts uwa
          WHERE uwa.user_id = u.id
        ) THEN 70
        WHEN COALESCE(NULLIF(TRIM(u.full_name),''),'') <> ''
          AND COALESCE(NULLIF(TRIM(u.phone_number),''),'') <> ''
          AND COALESCE(NULLIF(TRIM(u.phone_country_code),''),'') <> ''
        THEN 60
        ELSE 50
      END
      +
      (
        SELECT COUNT(*)::int
        FROM users invited
        WHERE invited.referred_by_id = u.id
          AND COALESCE(invited.withdraw_enabled,false) = true
      )
    )::int AS computed_points
  FROM users u
)
UPDATE users u
SET credit_points = computed.computed_points
FROM computed
WHERE computed.id = u.id;

DO $$
BEGIN
  RAISE NOTICE 'Sistema de puntos de crédito v1.0.76 aplicado.';
END $$;
