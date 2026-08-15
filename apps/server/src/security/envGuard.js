import { isProduction } from '../config/index.js';
export { isProduction };
import { SSLConfig } from './SSLConfig.js';

/**
 * Retorna true si debemos usar HTTPS en este entorno local.
 * En producción (isProduction=true) retorna false (se asume que un ingress/proxy
 * manejará el SSL y Express escuchará en HTTP).
 */
export function isHttpsEnabled() {
  if (isProduction()) return false;
  // Usamos el flag inmutable establecido por SSLService en el arranque
  return process.env._RUNTIME_IS_HTTPS === 'true';
}

/** Ruta absoluta a los certificados SSL locales del plugin. */
export function getSslCertPaths() {
  return {
    cert: SSLConfig.CERT_PEM,
    key: SSLConfig.CERT_KEY,
  };
}

export function localDataEnabled() {
  return (
    process.env.USE_LOCAL_DATA === 'true' ||
    process.env.VITE_USE_LOCAL_DATA === 'true'
  );
}

/**
 * ¿Se permite el modo local (auth relajada + datos en memoria)?
 * En producción siempre devuelve false (fail-closed).
 */
export function isLocalModeAllowed() {
  if (!localDataEnabled()) return false;
  if (isProduction()) {
    console.error(
      '[SECURITY] USE_LOCAL_DATA activo en producción. Modo local BLOQUEADO (fail-closed).'
    );
    return false;
  }
  return true;
}

/**
 * Throws if critical environment variables are missing in production.
 * Devuelve la lista de faltantes en otros entornos (para warning).
 */
export function requireSecretsOrThrow(required = []) {
  // eslint-disable-next-line security/detect-object-injection
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length && isProduction()) {
    throw new Error(
      `Required environment variables missing in production: ${missing.join(', ')}`
    );
  }
  return missing;
}
