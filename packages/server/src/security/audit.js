/**
 * Utilidades de auditoría segura.
 *
 * CORRECCIÓN: el middleware de auditoría logueaba JSON.stringify(req.body)
 * completo, lo que puede registrar tokens/secretos. Aquí se redactan campos
 * sensibles antes de serializar.
 */

const SENSITIVE_KEYS = [
  'password',
  'pass',
  'token',
  'id_token',
  'lti_token',
  'accesstoken',
  'access_token',
  'apikey',
  'api_key',
  'apikeyencriptada',
  'secret',
  'authorization',
  'cookie',
];

const REDACTED = '[REDACTED]';

export function redactBody(body, max = 300) {
  if (body === null || body === undefined) return '';
  if (typeof body !== 'object') return String(body).substring(0, max);

  const walk = (value) => {
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(value)) {
        const key = k.toLowerCase();
        if (SENSITIVE_KEYS.some((s) => key.includes(s))) {
          out[k] = REDACTED;
        } else if (v && typeof v === 'object') {
          out[k] = walk(v);
        } else {
          out[k] = v;
        }
      }
      return out;
    }
    return value;
  };

  return JSON.stringify(walk(body)).substring(0, max);
}
