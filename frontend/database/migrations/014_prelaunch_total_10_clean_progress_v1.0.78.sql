-- Royal Imperial AI v1.0.78
-- Pre-lanzamiento:
-- Total máximo correcto: 10 USDT.
-- Distribución: 5 USDT check-in + 1 USDT invitado real + 4 USDT TikTok.
-- Se quitan los resúmenes visuales incorrectos del frontend; esta migración corrige PRD.

UPDATE prelaunch_config
SET
  cutoff_date = DATE '2026-07-07',
  max_checkin_days = 5,
  checkin_reward_usdt = 1,
  invite_reward_usdt = 1,
  tiktok_reward_usdt = 4,
  max_bonus_usdt = 10,
  block_financial_actions = TRUE,
  updated_at = CURRENT_TIMESTAMP
WHERE id = 1;

-- Las solicitudes pendientes de TikTok pasan al nuevo premio.
UPDATE prelaunch_tiktok_submissions
SET reward_usdt = 4,
    updated_at = CURRENT_TIMESTAMP
WHERE status = 'pending'
  AND reward_usdt <> 4;

DO $$
BEGIN
  RAISE NOTICE 'Pre-lanzamiento actualizado: máximo 10 USDT, TikTok pendiente 4 USDT.';
END $$;
