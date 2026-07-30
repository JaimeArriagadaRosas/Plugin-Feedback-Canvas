import { Router } from 'express';
import { validateLtiCallback, buildLtiCookie } from '../../services/infrastructure/LtiCallbackValidator.js';
import { secureState, secureNonce } from '../../security/crypto.js';
import { storeNonce } from '../../security/nonceStore.js';
import { isHttpsEnabled } from '../../security/envGuard.js';
import logger from '../../utils/logger.js';
import { handleLtiError } from '../../middlewares/LtiErrorHandler.js';
import { signSessionToken } from '../../services/infrastructure/SessionTokenService.js';
import { storeLtiState, consumeLtiState } from '../../security/stateStore.js';

const router = Router();

const loginHandler = async (req, res) => {
  const bodyData = (req.method === 'POST' && req.body && Object.keys(req.body).length > 0) ? req.body : req.query;
  const { iss, login_hint, target_link_uri, lti_message_hint } = bodyData;
  const reqId = Math.random().toString(36).substring(2, 8);
  logger.debug(`[LTI-LOGIN] OIDC Init Request recibida -> Iniciando flujo login`);

  if (!iss || !login_hint || !target_link_uri) {
    logger.warn(`[LTI-LOGIN] Parámetros LTI insuficientes detectados (Faltan: ${[!iss&&'iss', !login_hint&&'login_hint', !target_link_uri&&'target_link_uri'].filter(Boolean).join(', ')})`);
    
    // No exponemos req.body / req.query completos en la respuesta: pueden
    // contener login_hint, lti_message_hint u otros datos sensibles del launch.
    return res.status(400).json({
      error: 'Parámetros LTI insuficientes',
      required: ['iss', 'login_hint', 'target_link_uri'],
      received_params: Object.keys(bodyData)
    });
  } else {
    logger.debug(`[LTI-LOGIN] Validación inicial OK. Ensamblando redirección OIDC...`);
  }

  const state = secureState();
  const nonce = secureNonce();
  await storeNonce(nonce);

  const targetUrl = req.headers.referer || target_link_uri;
  
  const launchData = { nonce, targetUrl };
  storeLtiState(res, state, launchData);

  const canvasBaseUrl = (process.env.CANVAS_BASE_URL || 'https://localhost:8443').replace(/\/$/, '');
  const canvasAuthUrl = process.env.CANVAS_OIDC_URL || `${canvasBaseUrl}/api/lti/authorize_redirect`;
  const clientId = process.env.LTI_CLIENT_ID || '10000000000001';

  const defaultRedirectUri = 'https://localhost:3000/api/lti/callback';
  const envRedirectUri = process.env.LTI_REDIRECT_URI || defaultRedirectUri;
  let redirectUri = envRedirectUri;
  if (target_link_uri) {
    try {
      const target = new URL(target_link_uri);
      const base = new URL(envRedirectUri);
      if (target.origin === base.origin) {
        redirectUri = target_link_uri;
      }
    } catch {}
  }

  const authParams = new URLSearchParams({
    scope: 'openid',
    response_type: 'id_token',
    client_id: clientId,
    redirect_uri: redirectUri,
    login_hint,
    state,
    response_mode: 'form_post',
    nonce,
    prompt: 'none'
  });

  if (lti_message_hint) authParams.append('lti_message_hint', lti_message_hint);

  const redirectUrl = `${canvasAuthUrl}?${authParams.toString()}`;
  logger.info(`[LTI-LOGIN] 302 -> Redirigiendo a Canvas Authorize (Client ID: ${clientId})`);
  res.redirect(redirectUrl);
};

/**
 * Canvas authorize_redirect puede enviar al dominio del tool (p. ej. localhost:3000)
 * cuando domain.yml de Canvas apunta al puerto del plugin en lugar del puerto real
 * de Canvas (8080). Reenviamos a Canvas /api/lti/authorize para completar el OIDC.
 */
const authorizeHandler = (req, res) => {
  const reqId = Math.random().toString(36).substring(2, 8);
  const canvasBase = (process.env.CANVAS_BASE_URL || 'https://localhost:8443').replace(/\/$/, '');
  const canvasAuthorizeUrl = `${canvasBase}/api/lti/authorize`;

  // Reconstruimos la query string de forma robusta preservando repetidos y el
  // orden original. Object.fromEntries/URLSearchParams(req.query) puede perder
  // parámetros duplicados; usamos el rawQuery cuando está disponible.
  const rawQuery = req.originalUrl.includes('?')
    ? req.originalUrl.slice(req.originalUrl.indexOf('?') + 1)
    : new URLSearchParams(req.query).toString();
  const redirectUrl = rawQuery ? `${canvasAuthorizeUrl}?${rawQuery}` : canvasAuthorizeUrl;

  // Diagnóstico: si el authorize llegó al plugin en lugar de a Canvas es porque
  // el canvas_domain embebido en el lti_message_hint apunta al plugin (p.ej.
  // localhost:3000). Es esperado en Canvas Local; lo registramos para trazar el
  // "launch_no_longer_valid" (el rebote NO debe consumir el launch dos veces).
  logger.info(`[LTI-AUTHORIZE] [${reqId}] Reenviando authorize OIDC a Canvas`, {
    canvasBase,
    hasState: !!req.query.state,
    hasLoginHint: !!req.query.login_hint,
    url: redirectUrl.substring(0, 120) + '...'
  });
  // 307 preserva método y evita que algunos navegadores rehagan el POST/GET de
  // forma que reinicie el flujo. authorize es GET, así que 302 es correcto, pero
  // forzamos no-cache para impedir que un authorize cacheado reintente y consuma
  // el launch por segunda vez.
  res.set('Cache-Control', 'no-store');
  res.redirect(302, redirectUrl);
};

router.get('/login', loginHandler);
router.post('/login', loginHandler);
router.get('/authorize', authorizeHandler);

router.post('/callback', asyncSafe(async (req, res, next) => {
  const reqId = Math.random().toString(36).substring(2, 8);
  const bodyKeys = Object.keys(req.body || {});
  const hasIdToken = !!(req.body?.id_token || req.query?.id_token);
  const hasError = !!(req.body?.error || req.query?.error);
  const origin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : 'unknown');
  const cleanPath = req.originalUrl.split('?')[0];

  logger.debug(`[LTI-CALLBACK] Procesando callback con id_token...`);

  // Manejo robusto: Si Canvas envía la petición de inicio OIDC al target_link_uri (/callback)
  // en lugar del oidc_initiation_url (/login), lo detectamos por la presencia de login_hint y ausencia de id_token.
  const isOidcInitiation = (req.body?.login_hint && !req.body?.id_token && !req.body?.error) || 
                           (req.query?.login_hint && !req.query?.id_token && !req.query?.error);
  if (isOidcInitiation) {
    logger.info(`[LTI-CALLBACK] OIDC Initiation Request recibida -> Redirigiendo a flujo de login...`);
    return loginHandler(req, res);
  }

  // Defensa en profundidad CSRF (ref: Snyk/StackHawk CSRF SPA 2026):
  // el callback LTI es un form-post cross-origin desde el LMS; validamos que
  // el Origin/Referer corresponda al issuer/cliente conocido.
  const rawOrigin = req.headers.origin;
  const referer = req.headers.referer;
  const allowedOrigin = process.env.LTI_OIDC_URL
    ? new URL(process.env.LTI_OIDC_URL).origin
    : (process.env.CANVAS_OIDC_URL ? new URL(process.env.CANVAS_OIDC_URL).origin : null);

  if (allowedOrigin) {
    const refOrigin = rawOrigin || (referer ? new URL(referer).origin : null);
    if (refOrigin && refOrigin !== allowedOrigin) {
      logger.error(`[LTI-CALLBACK] [${reqId}] Origin/Referer no coincide con el LMS`, { origin: rawOrigin, referer, allowedOrigin });
      return res.status(403).json({ error: 'Origen del callback LTI no permitido.' });
    }
  }

  let claims;
  let savedReferer = req.headers.referer;
  
  if (req.body?.state || req.query?.state) {
    const state = req.body?.state || req.query?.state;
    const launchCookie = consumeLtiState(req, res, state);
    if (launchCookie && launchCookie.targetUrl) {
      savedReferer = launchCookie.targetUrl;
    }
  }

  try {
    logger.debug(`[LTI-CALLBACK] Iniciando validateLtiCallback...`);
    claims = await validateLtiCallback(req);
    logger.debug(`[LTI-CALLBACK] validateLtiCallback OK | sub=${claims.sub?.substring(0,8)}...`);
  } catch (err) {
    const status = err.statusCode || err.status || 401;
    logger.error(`[LTI-CALLBACK] [${reqId}] validateLtiCallback FALLÓ`, { status, message: err.message });
    
    // Auto-reparación: Mostrar pantalla de recuperación en lugar de un JSON plano
    return handleLtiError(res, err, savedReferer);
  }

  const token = (req.body && req.body.id_token) ? req.body.id_token : req.query.id_token;
  const cookie = buildLtiCookie(token);
  res.cookie(cookie.name, cookie.value, cookie.options);

  logger.info(`[LTI-AUTH] LOGIN LTI 1.3 EXITOSO`);
  const shortRoles = [...new Set((claims.roles || []).map(r => r.split('#').pop().split('/').pop()))];
  logger.info(`[LTI-AUTH] Usuario: ${claims.sub?.substring(0,8)}... | Roles: ${shortRoles.join(', ')}`);

  const sessionToken = await signSessionToken({
    sub: claims.sub,
    azp: claims.azp,
    deploymentId: claims.deploymentId,
    context: { id: claims.courseId, title: claims.courseName },
    lis: { person_name: claims.personName, person_email: claims.personEmail },
    roles: claims.roles,
    entry: claims.entry,
    studentId: claims.studentId,
  });

  const frontendUrl = process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || 'https://localhost:5173';
  const redirectUrl = `${frontendUrl}?lti_token=${encodeURIComponent(token)}&session_token=${encodeURIComponent(sessionToken)}`;
  logger.info(`[SESSION] Claves generadas. 302 -> Redirigiendo al frontend`);
  res.redirect(redirectUrl);
}));

router.get('/jwks', (req, res) => {
  logger.debug('JWKS endpoint consultado');
  const ltiPublicJwk = process.env.LTI_PUBLIC_JWK ? JSON.parse(process.env.LTI_PUBLIC_JWK) : null;
  if (ltiPublicJwk) {
    res.json({ keys: [ltiPublicJwk] });
  } else {
    res.json({ keys: [] });
  }
});

export default router;

/**
 * Wrapper async-safe: garantiza que un handler async siempre termine llamando
 * a res() o next(err). Si el handler se cuelga o lanza fuera de su propio
 * try/catch (p.ej. verifyToken/JWKS sin timeout), Express no captura la
 * promesa rechazada y la conexión queda abierta sin respuesta -> el navegador
 * recibe ERR_EMPTY_RESPONSE ("localhost no ha enviado ningún dato").
 * Este wrapper cierra ese agujero registrando el cuelgue y respondiendo 500.
 */
export function asyncSafe(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch((err) => {
      logger.error('[LTI] Handler async terminó con excepción NO capturada', {
        error: err?.stack || err?.message || String(err),
        path: req.originalUrl
      });
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error interno en el flujo LTI (handler async).' });
      }
      next(err);
    });
  };
}
