-- v1.1.01
-- Agrega tope de saldo retirable por códigos para Pasantía / sin nivel.

ALTER TABLE redeem_daily_limit_config
ADD COLUMN IF NOT EXISTS no_plan_withdrawable_cap_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE redeem_daily_limit_config
ADD COLUMN IF NOT EXISTS no_plan_withdrawable_cap_usdt NUMERIC(18,2) NOT NULL DEFAULT 5;

ALTER TABLE redeem_daily_limit_config
ALTER COLUMN no_plan_withdrawable_cap_usdt SET DEFAULT 5;

UPDATE redeem_daily_limit_config
SET
  no_plan_guarantee_cap_usdt = 5,
  no_plan_withdrawable_cap_active = TRUE,
  no_plan_withdrawable_cap_usdt = 5
WHERE id = 1;
