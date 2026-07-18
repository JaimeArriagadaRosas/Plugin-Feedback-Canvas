import db from '../data/db.js';
import { AppError } from '../utils/errors.js';

export default class AuditLogController {
  async getLogs(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const offset = (page - 1) * limit;

      const countRes = await db.query('SELECT COUNT(*) FROM Logs_Auditoria');
      const total = parseInt(countRes.rows[0].count, 10);

      const logsRes = await db.query(
        'SELECT * FROM Logs_Auditoria ORDER BY fecha DESC LIMIT $1 OFFSET $2',
        [limit, offset]
      );

      res.json({
        exito: true,
        data: {
          logs: logsRes.rows,
          pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
}
