import { AppError } from '../utils/errors.js';
import { classifyRoles, resolveEffectiveRole } from '../utils/roles.js';

export const requirePermission = (permissionKey) => {
  return async (req, res, next) => {
    try {
      const userRoles = req.appIdentity?.roles || [];
      const classification = classifyRoles(userRoles);
      const effectiveRole = resolveEffectiveRole(classification);

      const permissionsManager = req.app.get('permissionsManager');
      if (!permissionsManager) {
        return next(new AppError('Servicio de permisos no disponible', 500));
      }

      const hasAccess = await permissionsManager.checkPermission(effectiveRole, permissionKey, { 
        userId: req.appIdentity?.canonicalUserId 
      });

      if (!hasAccess) {
        return next(new AppError(`Acceso denegado: falta el permiso '${permissionKey}'.`, 403));
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};
