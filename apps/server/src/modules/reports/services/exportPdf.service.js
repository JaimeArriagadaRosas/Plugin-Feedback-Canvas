import logger from '../../../utils/logger.js';
import { createPdfReport } from './pdfReportRenderer.js';

export class PDFExportService {
  async generateReport(data, auditLogs = [], migrationLogs = []) {
    try {
      return await createPdfReport({ data, auditLogs, migrationLogs });
    } catch (error) {
      logger.error('[PDFExportService] Error generando PDF:', { error });
      throw error;
    }
  }
}
