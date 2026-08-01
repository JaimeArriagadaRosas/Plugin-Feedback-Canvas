import { HistogramService } from './histogram.service.js';
import { ExcelExportService } from './exportExcel.service.js';
import { PDFExportService } from './exportPdf.service.js';
import StatsService from '../../../services/StatsService.js';
import AuditManager from '../../audit/AuditManager.js';
import { ApiError } from '../../../utils/errors.js';
import logger from '../../../utils/logger.js';

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

  async exportToExcel(courseId = null) {
    try {
      const data = await this.feedbackRepo.listAll(5000, courseId);
      const auditData = await AuditManager.getCriticalLogs(200);
      return await this.excelExport.generateExcel(data, auditData.logs);
    } catch (err) {
      logger.error('[ReportsService] Error exportToExcel', { error: err });
      throw new ApiError('Error al generar archivo Excel', 500);
    }
  }

  async exportToPdf(courseId = null) {
    try {
      const data = await this.feedbackRepo.listAll(5000, courseId);
      const auditData = await AuditManager.getCriticalLogs(200);
      return await this.pdfExport.generateReport(data, auditData.logs);
    } catch (err) {
      logger.error('[ReportsService] Error exportToPdf', { error: err });
      throw new ApiError('Error al generar reporte PDF', 500);
    }
  }
}
