const jwt = require("jsonwebtoken");
const pool = require("../config/db");
require("dotenv").config();

let authSchemaPromise;
function ensureAuthVersionSchema() {
  if (!authSchemaPromise) {
    authSchemaPromise = pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_version INTEGER NOT NULL DEFAULT 0`);
  }
  return authSchemaPromise;
}

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No autorizado. Token no proporcionado." });
  }

  const token = authHeader.split(" ")[1];

  try {
    await ensureAuthVersionSchema();
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userResult = await pool.query(
      `SELECT id,email,COALESCE(auth_version,0)::int AS auth_version,COALESCE(is_banned,false) AS is_banned FROM users WHERE id=$1 LIMIT 1`,
      [decoded.userId]
    );
    if (!userResult.rows.length) {
      return res.status(401).json({ message: "La cuenta ya no existe." });
    }
    const account = userResult.rows[0];
    if (account.is_banned) {
      return res.status(403).json({ message: "Esta cuenta se encuentra bloqueada." });
    }
    if (Number(decoded.authVersion || 0) !== Number(account.auth_version || 0)) {
      return res.status(401).json({ message: "La sesión fue cerrada. Inicia sesión nuevamente." });
    }
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Token inválido o expirado." });
  }
}

module.exports = authMiddleware;
