import AuditManager, { AUDIT_EVENT_TYPES } from '../modules/audit/AuditManager.js';
import db from '../data/db.js';
import logger from '../utils/logger.js';
import { ApiError } from '../utils/errors.js';

export default class AuditLogControllerLocal {
  async getLogs(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;

      // In local development, we want to ensure there is at least some data in the REAL database
      // to test the UI functionality, without using in-memory mocks.
      await this._ensureLocalDataExists();

      const data = await AuditManager.getPaginatedLogs(page, limit);

      res.json({
        exito: true,
        data: data // Contains { logs: [], pagination: {} }
      });
    } catch (error) {
      if (error instanceof ApiError) {
        next(error);
      } else {
        next(new ApiError('Unexpected error fetching logs in local environment', 500));
      }
    }
  }

  async _ensureLocalDataExists() {
    try {
      const countRes = await db.query('SELECT COUNT(*) FROM Logs_Auditoria');
      const count = parseInt(countRes.rows[0].count, 10);

      if (count === 0) {
        logger.info('AuditLogControllerLocal', 'Local database is empty. Seeding real test data into Audit_Logs...');
        
        await AuditManager.logSecurityEvent(
          AUDIT_EVENT_TYPES.ACCESO_DENEGADO, 
          'student_123', 
          '192.168.1.5', 
          'Attempt to access configuration panel'
        );
        
        await AuditManager.logSecurityEvent(
          AUDIT_EVENT_TYPES.VALIDACION_LTI_FALLIDA, 
          null, 
          '192.168.1.10', 
          'Invalid or expired LTI token signature'
        );
        
        await AuditManager.logSecurityEvent(
          AUDIT_EVENT_TYPES.CONFIGURACION_IA_ALTERADA, 
          'admin_456', 
          '127.0.0.1', 
          'OpenAI token was updated'
        );
        
        logger.info('AuditLogControllerLocal', 'Data seeded successfully.');
      }
    } catch (error) {
      logger.error('AuditLogControllerLocal', 'Could not seed local data', { error });
    }
  }
}
