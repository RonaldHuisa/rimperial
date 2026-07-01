-- Royal Imperial AI v1.0.81
-- Soporte Admin: crear, guardar y editar canales WhatsApp/gerente/teléfono/telegram.
-- No borra datos existentes. Solo asegura columnas necesarias e índices.

CREATE TABLE IF NOT EXISTS support_channels (
  id SERIAL PRIMARY KEY,
  channel_type VARCHAR(40) NOT NULL DEFAULT 'whatsapp',
  label VARCHAR(120) NOT NULL,
  value VARCHAR(255) NOT NULL,
  url TEXT,
  description TEXT,
  sort_order INTEGER DEFAULT 0 NOT NULL,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE support_channels
  ADD COLUMN IF NOT EXISTS channel_type VARCHAR(40) DEFAULT 'whatsapp',
  ADD COLUMN IF NOT EXISTS label VARCHAR(120),
  ADD COLUMN IF NOT EXISTS value VARCHAR(255),
  ADD COLUMN IF NOT EXISTS url TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE NOT NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_support_channels_active_order
ON support_channels(is_active, sort_order, id);

DO $$
BEGIN
  RAISE NOTICE 'Soporte admin v1.0.81 listo: canales editables y guardables.';
END $$;
