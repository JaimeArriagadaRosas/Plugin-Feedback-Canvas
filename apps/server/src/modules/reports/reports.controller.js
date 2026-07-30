import { ApiError } from '../../utils/errors.js';
import logger from '../../utils/logger.js';

export class ReportsController {
  constructor(reportsService) {
    this.reportsService = reportsService;
  }

  async getStats(req, res, next) {
    try {
      const courseId = req.params.courseId === 'all' ? null : (req.params.courseId ? Number(req.params.courseId) : null);
      const data = await this.reportsService.getGlobalStats(courseId);
      res.json({ exito: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getRatings(req, res, next) {
    try {
      const courseId = req.params.courseId === 'all' ? null : (req.params.courseId ? Number(req.params.courseId) : null);
      const data = await this.reportsService.getGlobalRatings(courseId);
      res.json({ exito: true, data });
    } catch (error) {
      next(error);
    }
  }

  async exportExcel(req, res, next) {
    try {
      const courseId = req.params.courseId === 'all' ? null : (req.params.courseId ? Number(req.params.courseId) : null);
      const buffer = await this.reportsService.exportToExcel(courseId);
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="reporte_feedback_${courseId || 'global'}.xlsx"`);
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  }

  async exportPdf(req, res, next) {
    try {
      const courseId = req.params.courseId === 'all' ? null : (req.params.courseId ? Number(req.params.courseId) : null);
      const buffer = await this.reportsService.exportToPdf(courseId);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="reporte_feedback_${courseId || 'global'}.pdf"`);
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  }
}
