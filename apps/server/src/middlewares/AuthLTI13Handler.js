import { AppError } from '../utils/errors.js';
import { isLocalModeAllowed } from '../security/envGuard.js';
import { nowIso } from '../utils/datetime.js';
import logger from '../utils/logger.js';
import crypto from 'crypto';

import { LtiIdentityProvider } from '../security/identityProviders/LtiIdentityProvider.js';
import { ApiTokenIdentityProvider } from '../security/identityProviders/ApiTokenIdentityProvider.js';
import { IdentityProviderLocal } from '../security/identityProviders/IdentityProvider.local.js';
import { LTI_PUBLIC_ROUTES } from '../config/lti-public-routes.js';
import { shouldRefreshLtiCookie, refreshLtiCookieOptions } from '../security/ltiCookie.js';
import { verifyDevToken } from '../security/crypto.js';
import { verifySessionToken } from '../services/infrastructure/SessionTokenService.js';
import { getRolesFromClaims, getEntryFromClaims } from '../utils/roles.js';

class SessionTokenIdentityProvider {
  name = 'session-token';

  async authenticate(req) {
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    if (!bearerToken || !bearerToken.startsWith('eyJ')) return null;

    try {
      const decoded = await verifySessionToken(bearerToken);
      const ltiRoles = getRolesFromClaims(decoded);
      const customClaims = decoded['https://purl.imsglobal.org/spec/lti/claim/custom'] || {};
      return {
        user: decoded.sub,
        name: decoded.name || 'Usuario',
        role: ltiRoles,
        courseId: decoded['https://purl.imsglobal.org/spec/lti/claim/context']?.id,
        courseName: decoded['https://purl.imsglobal.org/spec/lti/claim/context']?.title,
        deploymentId: decoded['https://purl.imsglobal.org/spec/lti/claim/deployment_id'],
        studentId: customClaims.canvas_user_id || customClaims.user_id || null,
        isLocalSession: false,
        entry: getEntryFromClaims(decoded),
        source: 'session-token'
      };
    } catch (e) {
      logger.debug(`[SESSION-AUTH] Token rechazado: ${e.message}`);
      return null;
    }
  }
}

const providers = [
  new SessionTokenIdentityProvider(),
  new LtiIdentityProvider(),
  new ApiTokenIdentityProvider(),
  new IdentityProviderLocal()
];

export const refreshLtiTokenCookie = (req, res, next) => {
  if (shouldRefreshLtiCookie(req)) {
    const cookie = refreshLtiCookieOptions(req, res);
    if (cookie) {
      res.cookie(cookie.name, cookie.value, cookie.options);
      logger.info('[LTI-AUTH] Cookie lti-token refrescada', { maxAge: cookie.options.maxAge });
    }
  }
  next();
};

export const AuthLTI13Handler = async (req, res, next) => {
  const timestamp = nowIso();
  const reqId = crypto.randomBytes(4).toString('hex');
  const path = req.path;
  const method = req.method;

  try {
    const isPublic = LTI_PUBLIC_ROUTES.some(pub => path === pub || path.startsWith(pub));
    if (isPublic) {
      const isHealthCheck = path.includes('/config/startup-mode') || path.includes('/health');
      if (!isHealthCheck) {
        logger.info(`[HTTP] ${method} ${path} -> [LTI-AUTH] Ruta pública (OK)`);
      }
      return next();
    }

    for (const provider of providers) {
      try {
        const identity = await provider.authenticate(req);
        if (identity) {
          req.ltiContext = {
            user: identity.user,
            name: identity.name,
            role: identity.role,
            courseId: identity.courseId,
            courseName: identity.courseName,
            studentId: identity.studentId,
            isLocalSession: identity.isLocalSession,
            localRole: identity.localRole,
            source: identity.source,
            entry: identity.entry
          };
          req.user = { id: identity.user };

          logger.info(`[HTTP] ${method} ${path} -> [AUTH] Sesión válida vía ${provider.name} | Usuario: ${identity.user?.substring(0,8)}...`);
          return next();
        }
      } catch (error) {
        // Si el provider lanza un error definitivo como 403 (deployment no permitido),
        // detenemos la cadena.
        // Si es 401 (token LTI inválido o expirado), permitimos que otro provider (ej. ApiToken) intente.
        if (error instanceof AppError && error.statusCode === 403) {
          throw error;
        }
      }
    }

    logger.error(`[LTI-AUTH] [${reqId}] [X] BLOQUEADO: Sin token válido y ruta protegida: ${path}`);
    logger.error(`[LTI-AUTH] [${reqId}] CAUSA PROBABLE 1: El plugin no fue iniciado desde Canvas LMS.`);
    logger.error(`[LTI-AUTH] [${reqId}] CAUSA PROBABLE 2: Las cookies de terceros están bloqueadas en tu navegador (necesario para LTI).`);
    throw new AppError('No autorizado: Token LTI 1.3 ausente. Inicie el plugin desde Canvas LMS y permita cookies de terceros.', 401);

  } catch (error) {
    logger.error(`[LTI-AUTH] [${reqId}] Error en handler:`, error.message);
    next(error);
  }
};


