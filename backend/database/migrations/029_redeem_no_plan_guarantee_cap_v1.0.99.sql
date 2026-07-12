-- Royal Imperial AI v1.0.99
-- Tope configurable de saldo de garantía por códigos para usuarios sin plan activo / Pasantía.

ALTER TABLE redeem_daily_limit_config
ADD COLUMN IF NOT EXISTS no_plan_guarantee_cap_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE redeem_daily_limit_config
ADD COLUMN IF NOT EXISTS no_plan_guarantee_cap_usdt NUMERIC(18,2) NOT NULL DEFAULT 5;

UPDATE redeem_daily_limit_config
SET
  no_plan_guarantee_cap_active = COALESCE(no_plan_guarantee_cap_active, TRUE),
  no_plan_guarantee_cap_usdt = COALESCE(no_plan_guarantee_cap_usdt, 5)
WHERE id = 1;
