import { AppError } from '../utils/errors.js';
import logger from '../utils/logger.js';

export default class PermissionsController {
  constructor(permissionsManager) {
    this.permissionsManager = permissionsManager;
  }

  async getAllPermissions(req, res, next) {
    try {
      // Retorna la matriz calculada por el Manager (defaults + overrides)
      const data = await this.permissionsManager.getPermissionsMatrix();
      res.json({ exito: true, data });
    } catch (error) {
      logger.error('Error obteniendo la matriz de permisos', { error: error.message });
      next(error);
    }
  }

  async updatePermissions(req, res, next) {
    try {
      const { role } = req.params;
      const permissions = req.body;
      
      if (!role) {
        throw new AppError('El rol es obligatorio', 400);
      }

      if (!permissions || typeof permissions !== 'object') {
        throw new AppError('Formato de permisos inválido', 400);
      }

      // Solo guardará las llaves que sean permitidas (mutables) según la estrategia del rol
      const data = await this.permissionsManager.updateRoleOverrides(role, permissions);
      res.json({ exito: true, data, mensaje: 'Permisos actualizados correctamente' });
    } catch (error) {
      logger.error('Error actualizando permisos', { role: req.params.role, error: error.message });
      next(error);
    }
  }
}
