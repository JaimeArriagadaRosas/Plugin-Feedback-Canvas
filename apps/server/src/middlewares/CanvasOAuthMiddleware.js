import logger from '../utils/logger.js';

// In-memory mutex to prevent Thundering Herd on LTI token refreshes
const refreshLocks = new Map();

/**
 * Middleware to ensure the user has a Canvas API Token (OAuth2).
 *
 * Each user must authorize individually through the OAuth2 flow.
 * The CANVAS_ACCESS_TOKEN in .env is a system/infrastructure token used
 * only for boot-time operations (LTI verification, maintenance scripts).
 * It is never used as a fallback for user authentication.
 */
export const requireCanvasOAuth = (canvasTokenManagerOrRepo) => {
  return async (req, res, next) => {
    try {
      // req.appIdentity is populated by AuthLTI13Handler.
      // In LTI mode, ltiUserId is the Canvas UUID or sub.
      // req.user.id also points to this value.
      const canvasSub = req.appIdentity?.ltiUserId || req.user?.id;

      if (!canvasSub) {
         logger.warn('[CanvasOAuthMiddleware] Could not determine canvasSub from ltiContext. Proceeding without token.');
         return next();
      }

      let accessToken = null;

      if (typeof canvasTokenManagerOrRepo.getValidToken === 'function') {
        // Use CanvasTokenManager to securely get or refresh the token (Mutex)
        try {
          if (!refreshLocks.has(canvasSub)) {
            const tokenPromise = canvasTokenManagerOrRepo.getValidToken(canvasSub)
              .finally(() => refreshLocks.delete(canvasSub));
            refreshLocks.set(canvasSub, tokenPromise);
          }
          accessToken = await refreshLocks.get(canvasSub);
        } catch (e) {
          if (!e.metadata?.requireOAuth) throw e;
          // Do not re-throw here: it will be handled in if (!accessToken) below
        }
      } else {
        // Fallback to the repository if the manager was not injected
        const tokenData = await canvasTokenManagerOrRepo.getToken(canvasSub);
        accessToken = tokenData?.accessToken;
      }

      if (!accessToken) {
        // Send a structured 401 that the Frontend will interpret to launch the OAuth flow
        logger.info(`[CanvasOAuthMiddleware] Canvas Token not found for sub ${canvasSub}. Requiring OAuth.`);
        return res.status(401).json({
          exito: false,
          error: {
            codigo: 401,
            mensaje: 'Missing authorization for the Canvas API',
            requireOAuth: true,
            oauthUrl: '/api/oauth2/canvas/login'
          }
        });
      }

      // Inject the token into the request for the controller
      req.canvasToken = accessToken;
      next();
    } catch (err) {
      if (err.name === 'AppError' && err.statusCode === 401 && err.metadata?.requireOAuth) {
        logger.info(`[CanvasOAuthMiddleware] Invalid or expired token without refresh for sub ${req.appIdentity?.ltiUserId || req.user?.id}. Requiring OAuth.`);
        return res.status(401).json({
          exito: false,
          error: {
            codigo: 401,
            mensaje: err.message || 'Missing authorization for the Canvas API',
            requireOAuth: true,
            oauthUrl: '/api/oauth2/canvas/login'
          }
        });
      }
      
      logger.error('[CanvasOAuthMiddleware] Error verifying Canvas token', err);
      next(err);
    }
  };
};
