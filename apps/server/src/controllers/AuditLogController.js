import AuditManager from '../modules/audit/AuditManager.js';
import { ApiError } from '../utils/errors.js';

export default class AuditLogController {
  async getLogs(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;

      // In production, we only return the last 200 critical logs to avoid saturation
      const data = await AuditManager.getCriticalLogs(200);

      res.json({
        exito: true,
        data: data // Contains { logs: [], pagination: {} }
      });
    } catch (error) {
      if (error instanceof ApiError) {
        next(error);
      } else {
        next(new ApiError('Unexpected error while retrieving audit logs', 500));
      }
    }
  }
}
