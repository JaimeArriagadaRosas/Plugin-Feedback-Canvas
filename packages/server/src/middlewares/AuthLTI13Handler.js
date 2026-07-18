import { AppError } from '../utils/errors.js';
import { isLocalModeAllowed } from '../security/envGuard.js';
import { nowIso } from '../utils/datetime.js';
import logger from '../utils/logger.js';
import crypto from 'crypto';

import { LtiIdentityProvider } from '../security/identityProviders/LtiIdentityProvider.js';
import { ApiTokenIdentityProvider } from '../security/identityProviders/ApiTokenIdentityProvider.js';
import { LocalIdentityProvider } from '../security/identityProviders/LocalIdentityProvider.js';
import { LTI_PUBLIC_ROUTES } from '../config/lti-public-routes.js';
import { shouldRefreshLtiCookie, refreshLtiCookieOptions } from '../security/ltiCookie.js';

const providers = [
  new LtiIdentityProvider(),
  new ApiTokenIdentityProvider(),
  new LocalIdentityProvider()
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

  logger.info(`[LTI-AUTH] [${reqId}] ${timestamp} -> ${method} ${path}`);

  try {
    const isPublic = LTI_PUBLIC_ROUTES.some(pub => path === pub || path.startsWith(pub));
    if (isPublic) {
      logger.info(`[LTI-AUTH] [${reqId}] Ruta pública, sin requerir token: ${path}`);
      return next();
    }

    for (const provider of providers) {
      const identity = await provider.authenticate(req);
      if (identity) {
        req.ltiContext = {
          user: identity.user,
          role: identity.role,
          courseId: identity.courseId,
          studentId: identity.studentId,
          isLocalSession: identity.isLocalSession,
          localRole: identity.localRole,
          source: identity.source,
          entry: identity.entry
        };
        req.user = { id: identity.user };

        logger.info(`[LTI-AUTH] [${reqId}] [OK] Sesión establecida por ${provider.name} | Usuario: ${identity.user} | Rol: ${identity.localRole || 'N/A'} | StudentId: ${identity.studentId ?? 'N/A'} | Fuente: ${identity.source}`);
        return next();
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

export { AppError };
