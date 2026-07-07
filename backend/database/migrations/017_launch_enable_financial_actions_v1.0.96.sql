-- Royal Imperial AI lanzamiento oficial
-- Habilita compra de planes R1-R8 y elimina bloqueo financiero de pre-lanzamiento.

UPDATE prelaunch_config
SET block_financial_actions = FALSE,
    cutoff_date = DATE '2026-07-07',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 1;

UPDATE vip_packages
SET is_purchasable = TRUE,
    updated_at = NOW()
WHERE level BETWEEN 1 AND 8;
