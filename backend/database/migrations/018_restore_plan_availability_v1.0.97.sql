-- v1.0.97: restaurar disponibilidad de planes como estaba antes del lanzamiento.
-- Solo R1 queda disponible por defecto. R2-R8 vuelven a "Próximamente".
-- Luego el Panel Admin puede habilitar manualmente los planes que correspondan.
UPDATE vip_packages
SET is_purchasable = CASE
  WHEN level = 1 THEN TRUE
  WHEN level BETWEEN 2 AND 8 THEN FALSE
  ELSE is_purchasable
END,
updated_at = NOW()
WHERE level BETWEEN 1 AND 8;
