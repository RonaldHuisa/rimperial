-- Royal Imperial AI v1.0.85
-- Corrección visual del panel Admin > Pre-lanzamiento en móvil.
-- No requiere cambios en base de datos.

DO $$
BEGIN
  RAISE NOTICE 'v1.0.85: métricas de Pre-lanzamiento admin visibles en móvil.';
END $$;
