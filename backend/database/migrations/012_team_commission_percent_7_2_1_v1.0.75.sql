-- Royal Imperial AI v1.0.75
-- Actualización de comisiones de equipo:
-- Nivel 1 = 7%
-- Nivel 2 = 2%
-- Nivel 3 = 1%
--
-- Las nuevas comisiones se aplican por código desde backend/src/services/referralCommissionService.js.
-- Las comisiones ya registradas en referral_commissions se mantienen sin cambios para conservar historial.
-- No se actualizan registros históricos.

DO $$
BEGIN
  RAISE NOTICE 'Comisiones de equipo actualizadas por código: Nivel 1 7%%, Nivel 2 2%%, Nivel 3 1%%.';
END $$;
