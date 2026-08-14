import path from 'node:path';
import fs from 'node:fs';
import { getEnv, getCanvasEnv, isLocalDataEnabled, isProduction } from '../../config/index.js';
import { SECRET_REGISTRY, getSecret } from '../../config/secrets.js';
import configManager from '../config/ConfigManager.js';
import logger from '../../utils/logger.js';

export function resolveEnv() {
  const useLocalData = isLocalDataEnabled();

  if (useLocalData && isProduction()) {
    logger.warn('USE_LOCAL_DATA active in production environment. This disables real LTI security.');
  }

  const canvasBaseUrl = configManager.getCanvasBaseUrl();
  let canvasAccessToken = getCanvasEnv('CANVAS_ACCESS_TOKEN', 'VITE_CANVAS_ACCESS_TOKEN');
  const canvasApiHost = getEnv('CANVAS_API_HOST', process.env.STARTUP_MODE === '3' ? 'canvas.local' : 'localhost:8443');
  const canvasCourseId = getCanvasEnv('CANVAS_COURSE_ID', 'VITE_CANVAS_COURSE_ID') || '1';
  const canvasClientId = configManager.getLtiClientId();
  const canvasIssuer = configManager.getCanvasIssuer();
  const webhookSecret = getSecret('WEBHOOK_SECRET');
  const allowedDeploymentIds = configManager.getLtiDeploymentIds();

  if (!webhookSecret) {
    logger.warn('WEBHOOK_SECRET not configured. Canvas webhooks will not be authenticated.');
  }

  if (!canvasAccessToken) {
    logger.warn('[BOOTSTRAP] CANVAS_ACCESS_TOKEN not found in the environment.');
  }

  return {
    useLocalData, canvasBaseUrl, canvasAccessToken, canvasCourseId,
    canvasClientId, canvasIssuer, webhookSecret, allowedDeploymentIds, canvasApiHost
  };
}

/**
 * Localiza el build del frontend (dist/index.html) de forma robusta.
 */
export function resolveFrontendDist(startDir) {
  if (process.env.FRONTEND_DIST) {
    return path.resolve(process.env.FRONTEND_DIST);
  }

  let dir = startDir;
  for (let i = 0; i < 12; i++) {
    const candidate = path.join(dir, 'dist');
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (fs.existsSync(path.join(candidate, 'index.html'))) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  logger.warn('[FRONTEND] Build not found (dist/index.html). SPA will not be served statically from el backend.');
  logger.warn('[FRONTEND] -> If you are developing, Vite will serve it. Opcionalmente ejecuta "npm run build".');
  return path.join(startDir, '../../../../../../dist');
}

export function logSecretsSummary() {
  const missing = Object.keys(SECRET_REGISTRY).filter(nombre => !getSecret(nombre));
  if (missing.length) {
    logger.info(`[BOOTSTRAP] Secret status verified (${missing.join(', ')}: MISSING).`);
  } else {
    logger.info(`[BOOTSTRAP] Secret status verified (OK).`);
  }
}
