import { Router } from 'express';
import { validateLtiCallback, buildLtiCookie } from '../../services/infrastructure/LtiCallbackValidator.js';
import { secureState, secureNonce } from '../../security/crypto.js';
import { storeNonce } from '../../security/nonceStore.js';
import logger from '../../utils/logger.js';
import { handleLtiError } from '../../middlewares/LtiErrorHandler.js';
import { signSessionToken } from '../../services/infrastructure/SessionTokenService.js';
import { storeLtiState, consumeLtiState } from '../../security/stateStore.js';

const router = Router();

const loginHandler = async (req, res) => {
  const bodyData = (req.method === 'POST' && req.body && Object.keys(req.body).length > 0) ? req.body : req.query;
  const { iss, login_hint, target_link_uri, lti_message_hint } = bodyData;
  
  logger.debug(`[LTI-LOGIN] OIDC Init Request received -> Starting login flow`);

  if (!iss || !login_hint || !target_link_uri) {
    logger.warn(`[LTI-LOGIN] Insufficient LTI parameters detected (Missing: ${[!iss&&'iss', !login_hint&&'login_hint', !target_link_uri&&'target_link_uri'].filter(Boolean).join(', ')})`);
    
    // Do not expose full req.body / req.query in the response: they might
    // contain login_hint, lti_message_hint, or other sensitive launch data.
    return res.status(400).json({
      error: 'Insufficient LTI parameters',
      required: ['iss', 'login_hint', 'target_link_uri'],
      received_params: Object.keys(bodyData)
    });
  } else {
    logger.debug(`[LTI-LOGIN] Initial validation OK. Assembling OIDC redirection...`);
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
    } catch (e) { logger.warn('Invalid target_link_uri', { error: e.message }); }
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
  logger.info(`[LTI-LOGIN] 302 -> Redirecting to Canvas Authorize (Client ID: ${clientId})`);
  res.redirect(redirectUrl);
};

/**
 * Canvas authorize_redirect may send to the tool's domain (e.g., localhost:3000)
 * when Canvas domain.yml points to the plugin's port instead of Canvas's real
 * port (8080). We forward to Canvas /api/lti/authorize to complete the OIDC.
 */
const authorizeHandler = (req, res) => {
  const reqId = Math.random().toString(36).substring(2, 8);
  const canvasBase = (process.env.CANVAS_BASE_URL || 'https://localhost:8443').replace(/\/$/, '');
  const canvasAuthorizeUrl = `${canvasBase}/api/lti/authorize`;

  // Reconstruct the query string robustly, preserving duplicates and original
  // order. Object.fromEntries/URLSearchParams(req.query) might lose
  // duplicate parameters; we use rawQuery when available.
  const rawQuery = req.originalUrl.includes('?')
    ? req.originalUrl.slice(req.originalUrl.indexOf('?') + 1)
    : new URLSearchParams(req.query).toString();
  const redirectUrl = rawQuery ? `${canvasAuthorizeUrl}?${rawQuery}` : canvasAuthorizeUrl;

  // Diagnostic: if authorize reached the plugin instead of Canvas, it's because
  // the canvas_domain embedded in the lti_message_hint points to the plugin (e.g.,
  // localhost:3000). This is expected in Canvas Local; we log it to trace the
  // "launch_no_longer_valid" (the bounce MUST NOT consume the launch twice).
  logger.info(`[LTI-AUTHORIZE] [${reqId}] Forwarding OIDC authorize to Canvas`, {
    canvasBase,
    hasState: !!req.query.state,
    hasLoginHint: !!req.query.login_hint,
    url: redirectUrl.substring(0, 120) + '...'
  });
  // 307 preserves the method and prevents some browsers from redoing POST/GET in
  // a way that restarts the flow. authorize is GET, so 302 is correct, but
  // we force no-cache to prevent a cached authorize from retrying and consuming
  // the launch a second time.
  res.set('Cache-Control', 'no-store');
  res.redirect(302, redirectUrl);
};

router.get('/login', loginHandler);
router.post('/login', loginHandler);
router.get('/authorize', authorizeHandler);

router.post('/callback', asyncSafe(async (req, res) => {
  const reqId = Math.random().toString(36).substring(2, 8);
  
  
  
  
  

  logger.debug(`[LTI-CALLBACK] Processing callback with id_token...`);

  // Robust handling: If Canvas sends the OIDC initiation request to target_link_uri (/callback)
  // instead of oidc_initiation_url (/login), we detect it by the presence of login_hint and absence of id_token.
  const isOidcInitiation = (req.body?.login_hint && !req.body?.id_token && !req.body?.error) || 
                           (req.query?.login_hint && !req.query?.id_token && !req.query?.error);
  if (isOidcInitiation) {
    logger.info(`[LTI-CALLBACK] OIDC Initiation Request received -> Redirecting to login flow...`);
    return loginHandler(req, res);
  }

  // CSRF defense-in-depth (ref: Snyk/StackHawk CSRF SPA 2026):
  // the LTI callback is a cross-origin form-post from the LMS; we validate that
  // the Origin/Referer matches the known issuer/client.
  const rawOrigin = req.headers.origin;
  const referer = req.headers.referer;
  const allowedOrigin = process.env.LTI_OIDC_URL
    ? new URL(process.env.LTI_OIDC_URL).origin
    : (process.env.CANVAS_OIDC_URL ? new URL(process.env.CANVAS_OIDC_URL).origin : null);

  if (allowedOrigin) {
    const refOrigin = rawOrigin || (referer ? new URL(referer).origin : null);
    if (refOrigin && refOrigin !== allowedOrigin) {
      logger.error(`[LTI-CALLBACK] [${reqId}] Origin/Referer does not match the LMS`, { origin: rawOrigin, referer, allowedOrigin });
      return res.status(403).json({ error: 'LTI callback origin not allowed.' });
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
    logger.debug(`[LTI-CALLBACK] Starting validateLtiCallback...`);
    claims = await validateLtiCallback(req);
    logger.debug(`[LTI-CALLBACK] validateLtiCallback OK | sub=${claims.sub?.substring(0,8)}...`);
  } catch (err) {
    const status = err.statusCode || err.status || 401;
    logger.error(`[LTI-CALLBACK] [${reqId}] validateLtiCallback FAILED`, { status, message: err.message });
    
    // Self-healing: Show recovery screen instead of a plain JSON
    return handleLtiError(res, err, savedReferer);
  }

  const token = (req.body && req.body.id_token) ? req.body.id_token : req.query.id_token;
  const cookie = buildLtiCookie(token);
  res.cookie(cookie.name, cookie.value, cookie.options);

  logger.info(`[LTI-AUTH] LTI 1.3 LOGIN SUCCESSFUL`);
  const shortRoles = [...new Set((claims.roles || []).map(r => r.split('#').pop().split('/').pop()))];
  logger.info(`[LTI-AUTH] User: ${claims.sub?.substring(0,8)}... | Roles: ${shortRoles.join(', ')}`);

  const sessionToken = await signSessionToken({
    sub: claims.sub,
    azp: claims.azp,
    deploymentId: claims.deploymentId,
    context: { id: claims.courseId, title: claims.courseName },
    lis: { person_name: claims.personName, person_email: claims.personEmail },
    roles: claims.roles,
    entry: claims.entry,
    studentId: claims.studentId,
    name: claims.personName,
  });

  const frontendUrl = process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || 'https://localhost:5173';
  const redirectUrl = `${frontendUrl}?lti_token=${encodeURIComponent(token)}&session_token=${encodeURIComponent(sessionToken)}`;
  logger.info(`[SESSION] Keys generated. 302 -> Redirecting to frontend`);
  res.redirect(redirectUrl);
}));

router.get('/jwks', (req, res) => {
  logger.debug('JWKS endpoint queried');
  const ltiPublicJwk = process.env.LTI_PUBLIC_JWK ? JSON.parse(process.env.LTI_PUBLIC_JWK) : null;
  if (ltiPublicJwk) {
    res.json({ keys: [ltiPublicJwk] });
  } else {
    res.json({ keys: [] });
  }
});

export default router;

/**
 * async-safe wrapper: ensures that an async handler always ends up calling
 * res() or next(err). If the handler hangs or throws outside its own
 * try/catch (e.g. verifyToken/JWKS without timeout), Express doesn't catch the
 * rejected promise and the connection stays open without a response -> the browser
 * receives ERR_EMPTY_RESPONSE ("localhost didn't send any data").
 * This wrapper plugs that hole by logging the hang and responding with a 500.
 */
export function asyncSafe(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch((err) => {
      logger.error('[LTI] Async handler ended with UNCAUGHT exception', {
        error: err?.stack || err?.message || String(err),
        path: req.originalUrl
      });
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal error in LTI flow (async handler).' });
      }
      next(err);
    });
  };
}
