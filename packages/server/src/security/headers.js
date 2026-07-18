import helmet from 'helmet';
import { getCanvasFrameAncestor } from './cors.js';

/**
 * Cabeceras de seguridad (Helmet) y CORS configurados según buenas prácticas
 * Express 2025/2026. El manejo de CORS vive en security/cors.js.
 *
 * Para un tool LTI 1.3 que se sirve dentro de un iframe del LMS:
 *  - frameguard:false y COOP/COEP relajados son NECESARIOS (el LMS embebe el tool
 *    y usa postMessage). Esto está justificado y no es un hallazgo de seguridad.
 *  - contentSecurityPolicy NUNCA debe desactivarse: se define una CSP explícita
 *    con frame-ancestors apuntando al origen del LMS (mitiga clickjacking y XSS).
 *  - CORS usa allowlist por entorno, nunca '*' con credentials.
 */

export function helmetMiddleware() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        frameAncestors: [getCanvasFrameAncestor()],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    frameguard: false,
    crossOriginResourcePolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginEmbedderPolicy: false,
    hsts:
      process.env.NODE_ENV === 'production'
        ? { maxAge: 31536000, includeSubDomains: true, preload: true }
        : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  });
}
