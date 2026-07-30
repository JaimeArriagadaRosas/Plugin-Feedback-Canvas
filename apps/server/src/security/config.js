/**
 * Configuración derivada y validada de LTI.
 *
 * El manejo de CORS y orígenes de confianza vive ahora en security/cors.js
 * (módulo dedicado). Aquí solo quedan las resoluciones de LTI que no son CORS.
 */

import { getEnv } from '../config/index.js';
import { getCanvasFrameAncestor } from './cors.js';

export { getCanvasFrameAncestor };

/**
 * Redirect URI del flujo OIDC LTI 1.3.
 * Siempre debe coincidir con el endpoint de callback real del tool.
 */
export function getLtiRedirectUri() {
  const configured = getEnv('LTI_REDIRECT_URI');
  if (configured && configured.endsWith('/api/lti/callback')) {
    return configured;
  }
  const base = getEnv('BASE_URL', 'https://localhost:3000');
  return `${base}/api/lti/callback`;
}
