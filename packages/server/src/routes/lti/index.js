import { Router } from 'express';
import { validateLtiCallback, buildLtiCookie } from '../../services/infrastructure/LtiCallbackValidator.js';
import { secureState, secureNonce } from '../../security/crypto.js';
import { storeNonce } from '../../security/nonceStore.js';
import { isHttpsEnabled } from '../../security/envGuard.js';
import logger from '../../utils/logger.js';

const router = Router();

const loginHandler = (req, res) => {
  const bodyData = (req.method === 'POST' && req.body && Object.keys(req.body).length > 0) ? req.body : req.query;
  const { iss, login_hint, target_link_uri, lti_message_hint } = bodyData;
  const reqId = Math.random().toString(36).substring(2, 8);
  logger.info(`[LTI-LOGIN] [$] [${reqId}] ENTRADA login`, { method: req.method, path: req.originalUrl, iss, login_hint: login_hint?.substring(0, 30), lti_message_hint: !!lti_message_hint });

  if (!iss || !login_hint || !target_link_uri) {
    logger.warn(`[LTI-LOGIN] [$] [${reqId}] Parámetros LTI insuficientes detectados.`);
    if (!iss) logger.warn(`[LTI-LOGIN] [$] [${reqId}] -> Falta 'iss' (Issuer)`);
    if (!login_hint) logger.warn(`[LTI-LOGIN] [$] [${reqId}] -> Falta 'login_hint'`);
    if (!target_link_uri) logger.warn(`[LTI-LOGIN] [$] [${reqId}] -> Falta 'target_link_uri'`);
    
    // No exponemos req.body / req.query completos en la respuesta: pueden
    // contener login_hint, lti_message_hint u otros datos sensibles del launch.
    return res.status(400).json({
      error: 'Parámetros LTI insuficientes',
      required: ['iss', 'login_hint', 'target_link_uri'],
      received_params: Object.keys(bodyData)
    });
  } else {
    logger.info(`[LTI-LOGIN] [$] [${reqId}] Validación primaria: OK. Parámetros básicos presentes.`);
  }

  const state = secureState();
  const nonce = secureNonce();
  storeNonce(nonce);

  const isProduction = isHttpsEnabled();
  const cookieSecure = isProduction;
  const cookieSameSite = isProduction ? 'None' : 'Lax';
  res.cookie('lti_state', state, { httpOnly: true, secure: cookieSecure, sameSite: cookieSameSite });
  res.cookie('lti_nonce', nonce, { httpOnly: true, secure: cookieSecure, sameSite: cookieSameSite });

  const canvasAuthUrl = process.env.CANVAS_OIDC_URL || 'https://localhost:8080/api/lti/authorize_redirect';
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
  logger.info(`[LTI-LOGIN] [$] [${reqId}] FLUJO OIDC URL ensamblada con éxito:\n\t- Client ID: ${clientId}\n\t- Redirect URI: ${redirectUri}\n\t- Destino: ${redirectUrl.substring(0, 120)}...`);
  logger.info(`[LTI-LOGIN] [$] [${reqId}] RESPONDIENDO redirect 302 a Canvas authorize`);
  res.redirect(redirectUrl);
};

/**
 * Canvas authorize_redirect puede enviar al dominio del tool (p. ej. localhost:3000)
 * cuando domain.yml de Canvas apunta al puerto del plugin en lugar del puerto real
 * de Canvas (8080). Reenviamos a Canvas /api/lti/authorize para completar el OIDC.
 */
const authorizeHandler = (req, res) => {
  const reqId = Math.random().toString(36).substring(2, 8);
  const canvasBase = (process.env.CANVAS_BASE_URL || 'https://localhost:8080').replace(/\/$/, '');
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
  logger.info(`[LTI-CALLBACK] [${reqId}] ENTRADA callback`, {
    method: req.method,
    path: req.originalUrl,
    hasIdToken: !!(req.body?.id_token || req.query?.id_token),
    hasLoginHint: !!(req.body?.login_hint || req.query?.login_hint),
    hasError: !!(req.body?.error || req.query?.error),
    bodyKeys,
    origin: req.headers.origin,
    referer: req.headers.referer
  });

  // Manejo robusto: Si Canvas envía la petición de inicio OIDC al target_link_uri (/callback)
  // en lugar del oidc_initiation_url (/login), lo detectamos por la presencia de login_hint y ausencia de id_token.
  const isOidcInitiation = (req.body?.login_hint && !req.body?.id_token && !req.body?.error) || 
                           (req.query?.login_hint && !req.query?.id_token && !req.query?.error);
  if (isOidcInitiation) {
    logger.info(`[LTI-CALLBACK] [${reqId}] Detectada petición OIDC Initiation Request. Redirigiendo al flujo de login...`);
    return loginHandler(req, res);
  }

  // Defensa en profundidad CSRF (ref: Snyk/StackHawk CSRF SPA 2026):
  // el callback LTI es un form-post cross-origin desde el LMS; validamos que
  // el Origin/Referer corresponda al issuer/cliente conocido.
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const allowedOrigin = process.env.LTI_OIDC_URL
    ? new URL(process.env.LTI_OIDC_URL).origin
    : (process.env.CANVAS_OIDC_URL ? new URL(process.env.CANVAS_OIDC_URL).origin : null);

  if (allowedOrigin) {
    const refOrigin = origin || (referer ? new URL(referer).origin : null);
    if (refOrigin && refOrigin !== allowedOrigin) {
      logger.error(`[LTI-CALLBACK] [${reqId}] Origin/Referer no coincide con el LMS`, { origin, referer, allowedOrigin });
      return res.status(403).json({ error: 'Origen del callback LTI no permitido.' });
    }
  }

  let claims;
  try {
    logger.info(`[LTI-CALLBACK] [${reqId}] ANTES de validateLtiCallback (inicia verifyToken/JWKS)`);
    claims = await validateLtiCallback(req);
    logger.info(`[LTI-CALLBACK] [${reqId}] DESPUÉS de validateLtiCallback (OK)`, {
      sub: claims.sub, iss: claims.iss, deploymentId: claims.deploymentId
    });
  } catch (err) {
    const status = err.statusCode || err.status || 401;
    logger.error(`[LTI-CALLBACK] [${reqId}] validateLtiCallback FALLÓ`, { status, message: err.message });
    return res.status(status).json({ error: err.message });
  }

  const token = (req.body && req.body.id_token) ? req.body.id_token : req.query.id_token;
  const cookie = buildLtiCookie(token);
  res.cookie(cookie.name, cookie.value, cookie.options);

  logger.info('[LTI-AUTH] [OK] LOGIN LTI 1.3 exitoso');
  logger.info(`[LTI-AUTH]   Usuario : ${claims.sub} (${claims.personName} <${claims.personEmail}>)`);
  logger.info(`[LTI-AUTH]   Permisos: ${claims.roles.join(', ') || 'N/A'}`);
  logger.info(`[LTI-AUTH]   Issuer  : ${claims.iss}`);
  logger.info(`[LTI-AUTH]   Deploy  : ${claims.deploymentId}`);
  logger.info(`[LTI-AUTH]   Entry   : ${claims.entry || 'N/A'}`);

  const frontendUrl = process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || 'https://localhost:5173';
  logger.info(`[LTI-CALLBACK] [${reqId}] RESPONDIENDO redirect 302 a frontend`, { frontendUrl });
  res.redirect(frontendUrl);
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
