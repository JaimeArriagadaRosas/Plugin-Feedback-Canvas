import AuditManager from '../modules/audit/AuditManager.js';
import { ApiError } from '../utils/errors.js';

export default class AuditLogController {
  async getLogs(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;

      // En producción, solo devolvemos los últimos 200 logs críticos para no saturar
      const data = await AuditManager.getCriticalLogs(200);

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
