import { AppError } from '../utils/errors.js';
import { nowIso } from '../utils/datetime.js';
import logger from '../utils/logger.js';
import crypto from 'crypto';

import { LtiIdentityProvider } from '../security/identityProviders/LtiIdentityProvider.js';
import { ApiTokenIdentityProvider } from '../security/identityProviders/ApiTokenIdentityProvider.js';
import { IdentityProviderLocal } from '../security/identityProviders/IdentityProvider.local.js';
import { LTI_PUBLIC_ROUTES } from '../config/lti-public-routes.js';
import { shouldRefreshLtiCookie, refreshLtiCookieOptions } from '../security/ltiCookie.js';
import { verifySessionToken } from '../services/infrastructure/SessionTokenService.js';
import { IdentityFactory } from '../domain/identity/IdentityFactory.js';

class SessionTokenIdentityProvider {
  name = 'session-token';

  async authenticate(req) {
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    if (!bearerToken || !bearerToken.startsWith('eyJ')) return null;

    try {
      const decoded = await verifySessionToken(bearerToken);
      return IdentityFactory.fromSessionToken(decoded);
    } catch (e) {
      logger.debug(`[SESSION-AUTH] Token rejected: ${e.message}`);
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
      logger.info('[LTI-AUTH] Cookie lti-token refreshed', { maxAge: cookie.options.maxAge });
    }
  }
  next();
};

export const AuthLTI13Handler = async (req, res, next) => {
  
  const reqId = crypto.randomBytes(4).toString('hex');
  const path = req.path;
  const method = req.method;

  try {
    const isPublic = LTI_PUBLIC_ROUTES.some(pub => path === pub || path.startsWith(pub));
    if (isPublic) {
      const isHealthCheck = path.includes('/config/startup-mode') || path.includes('/health');
      if (!isHealthCheck) {
        logger.info(`[HTTP] ${method} ${path} -> [LTI-AUTH] Public route (OK)`);
      }
      return next();
    }

    for (const provider of providers) {
      try {
        const identity = await provider.authenticate(req);
        if (identity) {
          req.appIdentity = identity;
          
          // Keep req.ltiContext for temporary backward compatibility, 
          // but delegate properties to req.appIdentity.
          req.ltiContext = {
            user: identity.ltiUserId,
            name: identity.name,
            role: identity.roles,
            courseId: identity.courseId,
            courseName: identity.courseName,
            studentId: identity.numericUserId,
            isLocalSession: identity.isLocalSession,
            localRole: identity.entry,
            source: identity.source,
            entry: identity.entry
          };
          req.user = { id: identity.ltiUserId };

          logger.info(`[HTTP] ${method} ${path} -> [AUTH] Valid session via ${provider.name} | User: ${identity.ltiUserId?.substring(0,8)}...`);
          return next();
        }
      } catch (error) {
        // If the provider throws a definitive error like 403 (deployment not allowed),
        // we stop the chain.
        // If it is 401 (invalid or expired LTI token), we allow another provider (e.g. ApiToken) to try.
        if (error instanceof AppError && error.statusCode === 403) {
          throw error;
        }
      }
    }

    logger.error(`[LTI-AUTH] [${reqId}] [X] BLOCKED: Without valid token and protected route: ${path}`);
    logger.error(`[LTI-AUTH] [${reqId}] PROBABLE CAUSE 1: The plugin was not started from Canvas LMS.`);
    logger.error(`[LTI-AUTH] [${reqId}] PROBABLE CAUSE 2: Third-party cookies are blocked in your browser (required for LTI).`);
    throw new AppError('Unauthorized: Missing LTI 1.3 Token. Start the plugin from Canvas LMS and allow third-party cookies.', 401);

  } catch (error) {
    logger.error(`[LTI-AUTH] [${reqId}] Error in handler:`, error.message);
    next(error);
  }
};


