export const PRELAUNCH_RECHARGE_CUTOFF = "2026-07-07";

export function getPeruDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

export function isRechargeLockedByPrelaunch(date = new Date()) {
  return getPeruDateString(date) <= PRELAUNCH_RECHARGE_CUTOFF;
}

export function rechargePrelaunchMessage() {
  return "Las recargas estarán disponibles después del pre-lanzamiento. Hasta el 7 de julio solo están activas las tareas de pasantía y bonos fundadores.";
}
