-- Royal Imperial AI v1.0.86
-- Bloqueo frontend de recargas durante pre-lanzamiento hasta el 7 de julio.
-- No requiere cambios en base de datos.

DO $$
BEGIN
  RAISE NOTICE 'v1.0.86: recargas bloqueadas visualmente hasta el 7 de julio.';
END $$;
