import logger from '../../../utils/logger.js';
import { createExcelReport } from './excelWorkbookBuilder.js';

export class ExcelExportService {
  async generateExcel(data, auditLogs = [], migrationLogs = [], systemNotifications = [], templatesHistory = []) {
    try {
      return await createExcelReport({ data, auditLogs, migrationLogs, systemNotifications, templatesHistory });
    } catch (error) {
      logger.error('[ExcelExportService] Error generando Excel:', { error });
      throw error;
    }
  }
}
