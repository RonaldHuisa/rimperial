-- Royal Imperial AI v1.0.80
-- Respeta configuración de niveles editada desde Panel Admin.
-- Esta migración NO sobrescribe precios, tareas, recompensa por tarea ni duración.
-- Desde esta versión, el backend lee la configuración real desde vip_packages.

ALTER TABLE vip_packages
  ADD COLUMN IF NOT EXISTS daily_tasks INTEGER,
  ADD COLUMN IF NOT EXISTS task_cooldown_seconds INTEGER;

DO $$
BEGIN
  RAISE NOTICE 'v1.0.80 aplicada: la configuración de vip_packages del Panel Admin queda como fuente principal.';
END $$;
