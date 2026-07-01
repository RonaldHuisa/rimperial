-- Royal Imperial AI v1.0.79
-- Modelo de tareas y niveles:
-- Pasantía: 5 días, 6 tareas diarias, 0.40 USDT diario.
-- VIP: 120 días calendario; trabajo de lunes a viernes; recuperación estimada en 25 días laborales.
-- R1-R8 con tareas por día 6,8,10,12,14,16,18,20.

ALTER TABLE vip_packages
  ADD COLUMN IF NOT EXISTS daily_tasks INTEGER,
  ADD COLUMN IF NOT EXISTS task_cooldown_seconds INTEGER;

INSERT INTO vip_packages(level, name, price_usdt, daily_income_usdt, valid_days, is_purchasable, task_reward_usdt, task_cooldown_minutes, task_cooldown_seconds, daily_tasks, updated_at)
VALUES
  (0, 'Pasantía', 0, 0.4000000000, 5, false, 0.0666666667, 1, 20, 6, NOW()),
  (1, 'R1', 30, 1.2000000000, 120, true, 0.2000000000, 1, 30, 6, NOW()),
  (2, 'R2', 80, 3.2000000000, 120, true, 0.4000000000, 1, 45, 8, NOW()),
  (3, 'R3', 150, 6.0000000000, 120, true, 0.6000000000, 1, 60, 10, NOW()),
  (4, 'R4', 300, 12.0000000000, 120, true, 1.0000000000, 2, 75, 12, NOW()),
  (5, 'R5', 600, 24.0000000000, 120, true, 1.7142857143, 2, 90, 14, NOW()),
  (6, 'R6', 1200, 48.0000000000, 120, true, 3.0000000000, 2, 105, 16, NOW()),
  (7, 'R7', 2500, 100.0000000000, 120, true, 5.5555555556, 2, 120, 18, NOW()),
  (8, 'R8', 5000, 200.0000000000, 120, true, 10.0000000000, 3, 150, 20, NOW())
ON CONFLICT (level) DO UPDATE SET
  name = EXCLUDED.name,
  price_usdt = EXCLUDED.price_usdt,
  daily_income_usdt = EXCLUDED.daily_income_usdt,
  valid_days = EXCLUDED.valid_days,
  is_purchasable = EXCLUDED.is_purchasable,
  task_reward_usdt = EXCLUDED.task_reward_usdt,
  task_cooldown_minutes = EXCLUDED.task_cooldown_minutes,
  task_cooldown_seconds = EXCLUDED.task_cooldown_seconds,
  daily_tasks = EXCLUDED.daily_tasks,
  updated_at = NOW();

-- Refuerzo de preguntas de pasantía para evitar repetición inmediata con 6 tareas diarias.
INSERT INTO ai_task_questions(level_min, category, asset, chart_type, title, question, option_a, option_b, option_c, correct_option, is_active)
SELECT *
FROM (VALUES
  (0,'risk','MARKET',NULL,'Pasantía · Riesgo','El mercado muestra cambios bruscos y señales mixtas. ¿Qué debería registrar la IA?','Mayor riesgo','Sin movimiento','Dato irrelevante','A',true),
  (0,'signal','MARKET',NULL,'Pasantía · Señal','Una señal de IA no tiene suficiente información para confirmar tendencia. ¿Qué clasificación es más prudente?','Cautela o neutral','Compra segura','Venta garantizada','A',true),
  (0,'volatility','MARKET','volatile','Pasantía · Volatilidad','El escenario muestra velas con cambios rápidos arriba y abajo. ¿Qué lectura corresponde?','Alta volatilidad','Tendencia estable','Sin datos','A',true)
) AS q(level_min, category, asset, chart_type, title, question, option_a, option_b, option_c, correct_option, is_active)
WHERE NOT EXISTS (
  SELECT 1 FROM ai_task_questions existing
  WHERE existing.level_min = q.level_min
    AND existing.title = q.title
);

DO $$
BEGIN
  RAISE NOTICE 'Modelo VIP/tareas v1.0.79 aplicado: Pasantía 6 tareas/0.40 diario, R1 desde 30 USDT.';
END $$;
