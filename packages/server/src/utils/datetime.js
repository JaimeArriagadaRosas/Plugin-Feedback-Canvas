/**
 * Utilidades de fecha/hora centralizadas.
 */

export function now() {
  return new Date();
}

export function nowIso() {
  return now().toISOString();
}

export function toTimestamp(date) {
  if (!date) return nowIso();
  if (typeof date.toISOString === 'function') return date.toISOString();
  return String(date);
}
