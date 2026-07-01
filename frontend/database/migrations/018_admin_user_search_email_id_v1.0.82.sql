-- Royal Imperial AI v1.0.82
-- Búsqueda de usuarios en Panel Admin por correo o ID.
-- No requiere cambios estructurales en base de datos.
-- El backend ahora filtra por:
--   - email parcial
--   - referral_code parcial
--   - id interno exacto

DO $$
BEGIN
  RAISE NOTICE 'v1.0.82 aplicada: búsqueda de usuarios por correo o ID disponible en backend/frontend.';
END $$;
