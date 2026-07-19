import logger from '../utils/logger.js';
import { isLocalModeAllowed } from '../security/envGuard.js';

/**
 * Middleware para asegurar que el usuario tenga un Canvas API Token (OAuth2)
 * o solicitar autorización a través del frontend.
 */
export const requireCanvasOAuth = (canvasTokenManagerOrRepo) => {
  return async (req, res, next) => {
    try {
      // req.ltiContext es poblado por AuthLTI13Handler.
      // En modo LTI, req.ltiContext.user es el Canvas UUID o sub.
      // req.user.id también apunta a este valor.
      const canvasSub = req.ltiContext?.user || req.user?.id;

      if (isLocalModeAllowed()) {
        // En modo local los datos vienen de CanvasServiceLocal y no requieren
        // un Canvas API Token (OAuth2) real. Se omite la verificación.
        return next();
      }

      if (!canvasSub) {
         logger.warn('[CanvasOAuthMiddleware] No se pudo determinar canvasSub desde ltiContext. Se procederá sin token.');
         return next();
      }

      let accessToken = null;

      if (typeof canvasTokenManagerOrRepo.getValidToken === 'function') {
        // Usar CanvasTokenManager para obtener o refrescar el token
        accessToken = await canvasTokenManagerOrRepo.getValidToken(canvasSub);
      } else {
        // Fallback al repositorio si no se inyectó el manager
        const tokenData = await canvasTokenManagerOrRepo.getToken(canvasSub);
        accessToken = tokenData?.accessToken;
      }
      
      if (!accessToken) {
        // Enviar un 401 estructurado que el Frontend interpretará para lanzar el flujo OAuth
        logger.info(`[CanvasOAuthMiddleware] Token Canvas no encontrado para sub ${canvasSub}. Requiriendo OAuth.`);
        return res.status(401).json({
          exito: false,
          error: {
            codigo: 401,
            mensaje: 'Falta autorización para la API de Canvas',
            requireOAuth: true,
            oauthUrl: '/api/oauth2/canvas/login'
          }
        });
      }

      // Inyectar el token en la petición para el controlador
      req.canvasToken = accessToken;
      next();
    } catch (err) {
      if (err.name === 'AppError' && err.statusCode === 401 && err.metadata?.requireOAuth) {
        logger.info(`[CanvasOAuthMiddleware] Token inválido o expirado sin refresco para sub ${req.ltiContext?.user || req.user?.id}. Requiriendo OAuth.`);
        return res.status(401).json({
          exito: false,
          error: {
            codigo: 401,
            mensaje: err.message || 'Falta autorización para la API de Canvas',
            requireOAuth: true,
            oauthUrl: '/api/oauth2/canvas/login'
          }
        });
      }
      
      logger.error('[CanvasOAuthMiddleware] Error verificando token de Canvas', err);
      next(err);
    }
  };
};
