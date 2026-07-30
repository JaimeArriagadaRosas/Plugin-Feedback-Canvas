import AuditManager from '../modules/audit/AuditManager.js';
import { ApiError } from '../utils/errors.js';

export default class AuditLogController {
  async getLogs(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;

      const data = await AuditManager.getPaginatedLogs(page, limit);

      res.json({
        exito: true,
        data: data // Contiene { logs: [], pagination: {} }
      });
    } catch (error) {
      if (error instanceof ApiError) {
        next(error);
      } else {
        next(new ApiError('Error inesperado al recuperar logs de auditoría', 500));
      }
    }
  }
}
