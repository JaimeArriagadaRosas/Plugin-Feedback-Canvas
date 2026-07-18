import { AppError } from '../utils/errors.js';

export default class PermissionsController {
  constructor(permissionsService) {
    this.permissionsService = permissionsService;
  }

  async getAllPermissions(req, res, next) {
    try {
      const data = await this.permissionsService.getAllPermissions();
      res.json({ exito: true, data });
    } catch (error) {
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

      const data = await this.permissionsService.updatePermissions(role, permissions);
      res.json({ exito: true, data, mensaje: 'Permisos actualizados correctamente' });
    } catch (error) {
      next(error);
    }
  }
}
