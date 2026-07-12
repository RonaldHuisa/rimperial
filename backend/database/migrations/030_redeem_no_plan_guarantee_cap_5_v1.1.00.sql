-- v1.1.00
-- Ajusta el tope de garantía por códigos para cuentas sin plan o en pasantía a 5 USDT.

ALTER TABLE redeem_daily_limit_config
ALTER COLUMN no_plan_guarantee_cap_usdt SET DEFAULT 5;

UPDATE redeem_daily_limit_config
SET no_plan_guarantee_cap_usdt = 5
WHERE no_plan_guarantee_cap_usdt IS NULL
   OR no_plan_guarantee_cap_usdt = 10;
