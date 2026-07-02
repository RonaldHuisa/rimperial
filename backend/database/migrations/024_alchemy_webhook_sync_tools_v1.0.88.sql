-- Royal Imperial AI v1.0.88
-- Alchemy webhooks/sync tools.
-- No cambia datos. Asegura índices útiles para wallets.

CREATE INDEX IF NOT EXISTS idx_wallets_network_address
ON wallets(network, LOWER(address));

DO $$
BEGIN
  RAISE NOTICE 'v1.0.88: rutas y scripts Alchemy webhook/sync disponibles.';
END $$;
