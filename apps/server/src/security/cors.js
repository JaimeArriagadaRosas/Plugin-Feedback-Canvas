/**
 * Módulo dedicado al manejo de CORS y orígenes de confianza del plugin.
 *
 * Centraliza toda la lógica de orígenes permitidos que antes estaba repartida
 * entre security/headers.js y security/config.js. Responsabilidades:
 *  - Resolver la allowlist de orígenes CORS a partir de env (frontend, Canvas,
 *    LMS real, CORS_ALLOWED_ORIGINS explícito).
 *  - Incluir AMBAS variantes de esquema (http y https) del origen de Canvas,
 *    porque en desarrollo local el navegador del LMS puede enviar el Origin
 *    con el esquema real desde el que se cargó la página (p.ej. el callback
 *    LTI llega con Origin: http://localhost:8080 si Canvas se abrió por HTTP).
 *  - Exponer el origen del LMS para la directiva frame-ancestors de la CSP.
 *  - Proveer un middleware CORS con allowlist por entorno, logging de diagnóstico
 *    y nunca '*' con credentials.
 */

import cors from 'cors';
import { getEnv } from '../config/index.js';
import logger from '../utils/logger.js';

/**
 * Normaliza una URL a su origen (scheme://host[:port]).
 * Devuelve null si no es una URL válida.
 */
function toOrigin(value) {
  if (!value) return null;
  try {
    const u = new URL(value);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

/**
 * Variante de esquema opuesta (https -> http, http -> https) del mismo host.
 * Útil para incluir en la allowlist el origen de Canvas servido por HTTP o HTTPS.
 */
function flipScheme(origin) {
  if (!origin) return null;
  if (origin.startsWith('https://')) return origin.replace('https://', 'http://');
  if (origin.startsWith('http://')) return origin.replace('http://', 'https://');
  return null;
}

/**
 * Resuelve la lista completa de orígenes CORS permitidos.
 *
 * Fuentes (en orden, sin duplicados):
 *   1. CORS_ALLOWED_ORIGINS (explícito, separado por coma) si está definido.
 *   2. FRONTEND_URL (origen del SPA del plugin).
 *   3. CANVAS_BASE_URL y su variante de esquema (http<->https).
 *   4. CANVAS_ISSUER y su variante de esquema (posible LMS real distinto).
 *   5. Fallback por defecto https://localhost:5173.
 */
export function getCorsOrigins() {
  const origins = [];

  const explicit = getEnv('CORS_ALLOWED_ORIGINS');
  if (explicit) {
    explicit.split(',').map((s) => s.trim()).filter(Boolean).forEach((o) => {
      const origin = toOrigin(o) || o; // respetamos literales si no es URL
      if (origin) origins.push(origin);
    });
  } else {
    const frontend = getEnv('FRONTEND_URL') || 'https://localhost:5173';
    const feOrigin = toOrigin(frontend);
    if (feOrigin) origins.push(feOrigin);
  }

  // Canvas / LMS: incluir ambas variantes de esquema para no romper el
  // callback LTI cuando el navegador del LMS usa HTTP o HTTPS.
  for (const envKey of ['CANVAS_BASE_URL', 'CANVAS_ISSUER']) {
    const value = getEnv(envKey);
    const origin = toOrigin(value);
    if (!origin) continue;
    origins.push(origin);
    const flipped = flipScheme(origin);
    if (flipped) origins.push(flipped);
  }

  // Desduplicar preservando orden.
  const unique = [...new Set(origins.filter(Boolean))];
  return unique.length ? unique : ['https://localhost:5173'];
}

/**
 * Origen del LMS para la directiva frame-ancestors de la CSP.
 * Por defecto usa CANVAS_BASE_URL; cae a la instancia pública de Canvas.
 */
export function getCanvasFrameAncestor() {
  return getEnv('CANVAS_BASE_URL', 'https://canvas.instructure.com');
}

/**
 * Middleware CORS basado en allowlist por entorno.
 *  - Un Origin ausente (healthchecks, webhooks y clientes server-to-server)
 *    se acepta. CORS es una política del navegador y no sustituye la
 *    autenticación o la firma propia de cada endpoint.
 *  - Cualquier Origin presente se valida contra la allowlist; si no coincide,
 *    se rechaza con un error claro y se registra para diagnóstico.
 */
export function corsMiddleware() {
  const allowed = getCorsOrigins();
  logger.info(`[CORS] Orígenes permitidos: ${JSON.stringify(allowed)}`);

  return cors({
    origin: (origin, cb) => {
      if (origin) {
        const permitido = allowed.includes(origin);
        logger.info(`[CORS] Solicitud con Origin: ${origin} -> ${permitido ? 'PERMITIDO' : 'RECHAZADO'}`);
        if (permitido) return cb(null, true);
        return cb(new Error('Origen no permitido por CORS'));
      }

      // Healthchecks, webhooks y otros clientes server-to-server normalmente
      // no envían Origin. Deben pasar CORS y ser protegidos por sus mecanismos
      // propios (firma HMAC, autenticación, red interna, etc.).
      return cb(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
    maxAge: 86400,
  });
}
