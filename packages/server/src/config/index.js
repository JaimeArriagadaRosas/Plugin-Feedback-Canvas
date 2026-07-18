/**
 * Capa central de configuración.
 *
 * Proxy fino sobre `process.env`. NO reemplaza `process.env`: centraliza las
 * lecturas para validación, máscara y auditoría, conservando los nombres de
 * claves, los defaults y la capacidad de MUTAR `process.env` en runtime (que
 * hoy usan main.js, SystemConfigController y los setup de test).
 *
 * Regla de oro para no romper nada: cualquier lectura migrada debe conservar
 * el mismo nombre de variable y el mismo valor por defecto que tenía.
 */

/** Lee una variable de entorno, devolviendo `fallback` si está ausente o vacía. */
export function getEnv(key, fallback) {
  const v = process.env[key];
  return v === undefined || v === '' ? fallback : v;
}

/** Lee un booleano de entorno ('true' | '1'). */
export function getEnvBool(key, fallback = false) {
  const v = process.env[key];
  if (v === undefined || v === '') return fallback;
  return v === 'true' || v === '1';
}

/** Escribe una variable de entorno (conserva mutaciones en runtime). */
export function setEnv(key, value) {
  if (value === undefined || value === null) {
    delete process.env[key];
  } else {
    process.env[key] = String(value);
  }
}

/** ¿Entorno de producción? */
export function isProduction() {
  return process.env.NODE_ENV === 'production';
}

/** ¿Está habilitado el modo de datos locales (auth relajada)? */
export function isLocalDataEnabled() {
  return getEnvBool('USE_LOCAL_DATA') || getEnvBool('VITE_USE_LOCAL_DATA');
}

/**
 * Lee una clave de backend con fallback a su equivalente VITE_ (legacy).
 * Mantiene el aviso de deprecación cuando se usa la clave VITE_.
 */
export function getCanvasEnv(key, viteKey) {
  const val = process.env[key];
  if (val) return val;

  const viteVal = process.env[viteKey];
  if (viteVal) {
    console.warn(`Variable de entorno deprecada: ${viteKey}. Usar ${key} en backend.`);
    return viteVal;
  }
  return undefined;
}
