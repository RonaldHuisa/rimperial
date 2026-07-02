-- Royal Imperial AI v1.0.87
-- Panel Admin > Usuarios > Detalle:
-- muestra wallets automáticas de recarga asignadas al usuario.
-- Esta migración solo asegura estructura básica de wallets.

CREATE TABLE IF NOT EXISTS wallets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  network VARCHAR(50) DEFAULT 'BEP20-USDT' NOT NULL,
  address VARCHAR(255) NOT NULL,
  public_key TEXT,
  private_key_encrypted TEXT,
  last_scanned_block BIGINT DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wallets_user_network ON wallets(user_id, network);

DO $$
BEGIN
  RAISE NOTICE 'v1.0.87: wallets automáticas visibles en detalle admin de usuario.';
END $$;
