import logger from '../utils/logger.js';

// Mutex en memoria para evitar Thundering Herd en refrescos de token LTI
const refreshLocks = new Map();

/**
 * Middleware para asegurar que el usuario tenga un Canvas API Token (OAuth2)
 * o solicitar autorización a través del frontend.
 *
 * Modo Docker Local (STARTUP_MODE=3):
 * En este modo, el token del profesor fue generado por TeacherTokenGenerator y
 * guardado en PostgreSQL bajo el `canvas_sub` de Rails (ej: 86157096483e...).
 * Sin embargo, el JWT de LTI 1.3 emite un `sub` diferente (UUID v4, ej: dc6074c0-...).
 * Para evitar el 401 durante el desarrollo local, este middleware usa directamente
 * CANVAS_ACCESS_TOKEN del .env como fallback cuando no se encuentra el token por
 * el sub del JWT. Esto es correcto en desarrollo local ya que hay un único profesor.
 *
 * En producción este fallback no aplica y se requiere el flujo OAuth2 real.
 */
export const requireCanvasOAuth = (canvasTokenManagerOrRepo) => {
  return async (req, res, next) => {
    try {
      // req.appIdentity es poblado por AuthLTI13Handler.
      // En modo LTI, ltiUserId es el Canvas UUID o sub.
      // req.user.id también apunta a este valor.
      const canvasSub = req.appIdentity?.ltiUserId || req.user?.id;

      if (!canvasSub) {
         logger.warn('[CanvasOAuthMiddleware] No se pudo determinar canvasSub desde ltiContext. Se procederá sin token.');
         return next();
      }

      let accessToken = null;

      if (typeof canvasTokenManagerOrRepo.getValidToken === 'function') {
        // Usar CanvasTokenManager para obtener o refrescar el token de forma segura (Mutex)
        try {
          if (!refreshLocks.has(canvasSub)) {
            const tokenPromise = canvasTokenManagerOrRepo.getValidToken(canvasSub)
              .finally(() => refreshLocks.delete(canvasSub));
            refreshLocks.set(canvasSub, tokenPromise);
          }
          accessToken = await refreshLocks.get(canvasSub);
        } catch (e) {
          if (!e.metadata?.requireOAuth) throw e;
          // No relanzar aquí: se manejará en el if (!accessToken) más abajo
        }
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
        logger.info(`[CanvasOAuthMiddleware] Token inválido o expirado sin refresco para sub ${req.appIdentity?.ltiUserId || req.user?.id}. Requiriendo OAuth.`);
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
