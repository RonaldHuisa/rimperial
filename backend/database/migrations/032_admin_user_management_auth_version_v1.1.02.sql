-- Royal Imperial AI v1.1.02
-- Gestión integral de usuarios desde Admin y cierre remoto de sesiones.

ALTER TABLE users
ADD COLUMN IF NOT EXISTS auth_version INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_users_auth_version ON users(id, auth_version);
