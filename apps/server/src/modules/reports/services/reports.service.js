import { HistogramService } from './histogram.service.js';
import { ExcelExportService } from './exportExcel.service.js';
import { PDFExportService } from './exportPdf.service.js';
import StatsService from '../../../services/StatsService.js';
import AuditManager from '../../audit/AuditManager.js';
import { ApiError } from '../../../utils/errors.js';
import logger from '../../../utils/logger.js';
import db from '../../../data/db.js';

export class ReportsService {
  constructor(feedbackRepo) {
    this.statsService = new StatsService(feedbackRepo);
    this.histogramService = new HistogramService();
    this.excelExport = new ExcelExportService();
    this.pdfExport = new PDFExportService();
    this.feedbackRepo = feedbackRepo;
  }

  async getGlobalStats(courseId = null, assignmentId = null) {
    try {
      return await this.statsService.getCourseStats(courseId, assignmentId);
    } catch (err) {
      logger.error('[ReportsService] Error getting global stats', { error: err });
      throw new ApiError('Error obteniendo estadísticas globales', 500);
    }
  }

  async getGlobalRatings(courseId = null, assignmentId = null) {
    try {
      const rawData = await this.statsService.getStudentRatingDistribution(courseId, assignmentId);
      return this.histogramService.buildHistogram(rawData);
    } catch (err) {
      logger.error('[ReportsService] Error getting ratings', { error: err });
      throw new ApiError('Error obteniendo distribucion de calificaciones', 500);
    }
  }

  async _getMigrationLogs() {
    try {
      const res = await db.query('SELECT version, status, logs, ejecutado_en FROM migration_logs ORDER BY ejecutado_en DESC LIMIT 100');
      return res.rows;
    } catch (err) {
      // Si la tabla aún no existe, devolvemos array vacío
      return [];
    }
  }

  async _getSystemNotifications() {
    try {
      const res = await db.query('SELECT * FROM notificaciones_sistema ORDER BY creado_en DESC LIMIT 500');
      return res.rows;
    } catch (err) {
      return [];
    }
  }

  async exportToExcel(courseId = null) {
    try {
      const data = await this.feedbackRepo.listAll(5000, courseId);
      const auditData = await AuditManager.getCriticalLogs(200);
      const migrationLogs = await this._getMigrationLogs();
      const systemNotifications = await this._getSystemNotifications();
      return await this.excelExport.generateExcel(data, auditData.logs, migrationLogs, systemNotifications);
    } catch (err) {
      logger.error('[ReportsService] Error exportToExcel', { error: err });
      throw new ApiError('Error al generar archivo Excel', 500);
    }
  }

  async exportToPdf(courseId = null) {
    try {
      const data = await this.feedbackRepo.listAll(5000, courseId);
      const auditData = await AuditManager.getCriticalLogs(200);
      const migrationLogs = await this._getMigrationLogs();
      return await this.pdfExport.generateReport(data, auditData.logs, migrationLogs);
    } catch (err) {
      logger.error('[ReportsService] Error exportToPdf', { error: err });
      throw new ApiError('Error al generar reporte PDF', 500);
    }
  }
}
