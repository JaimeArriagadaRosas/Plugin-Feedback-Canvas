import { AppError } from '../utils/errors.js';
import logger from '../utils/logger.js';

export default class PermissionsController {
  constructor(permissionsManager) {
    this.permissionsManager = permissionsManager;
  }

  async getAllPermissions(req, res, next) {
    try {
      // Returns the matrix calculated by the Manager (defaults + overrides)
      const data = await this.permissionsManager.getPermissionsMatrix();
      res.json({ exito: true, data });
    } catch (error) {
      logger.error('Error getting permissions matrix', { error: error.message });
      next(error);
    }
  }

  async updatePermissions(req, res, next) {
    try {
      const { role } = req.params;
      const permissions = req.body;
      
      if (!role) {
        throw new AppError('Role is required', 400);
      }

      if (!permissions || typeof permissions !== 'object') {
        throw new AppError('Invalid permissions format', 400);
      }

      // It will only save the keys that are allowed (mutable) according to the role's strategy
      const data = await this.permissionsManager.updateRoleOverrides(role, permissions);
      res.json({ exito: true, data, mensaje: 'Permissions updated successfully' });
    } catch (error) {
      logger.error('Error updating permissions', { role: req.params.role, error: error.message });
      next(error);
    }
  }
}
