import logger from '../../utils/logger.js';
import fs from 'fs';
import path from 'path';

export default class NotificationDiagnosticsLocal {
  constructor() {
    this.logFilePath = path.join(process.cwd(), 'logs', 'local-notifications-diagnostics.log');
  }

  logBulkApproval(feedbacksToProcess, currentTeacherId) {
    const summary = {
      timestamp: new Date().toISOString(),
      teacherId: currentTeacherId,
      totalProcessed: feedbacksToProcess.length,
      feedbacks: feedbacksToProcess.map(fb => ({
        id: fb.id,
        courseId: fb.curso_id,
        studentId: fb.estudiante_id,
        teacherId: fb.profesor_id,
      }))
    };
    
    const message = `[DIAGNOSTICS] Bulk Approval:\n${JSON.stringify(summary, null, 2)}\n\n`;
    
    logger.info(`[DIAGNOSTICS] Registrando resumen de lote aprobado (${summary.totalProcessed} feedbacks)`);
    
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      fs.appendFileSync(this.logFilePath, message);
    } catch (err) {
      logger.error('Error escribiendo log de diagnóstico local:', err);
    }
  }
}
