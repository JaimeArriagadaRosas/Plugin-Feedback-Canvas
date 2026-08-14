/**
 * Statistics Controller (RF46, RF47, RF48, RF49)
 *
 * Exposes endpoints to get counts, grade histograms
 * and feedback distribution, used in the Teacher and Administrator Panel.
 */
import { AppError } from '../utils/errors.js';

export default class StatsController {
  constructor(statsService) {
    this.statsService = statsService;
  }

  /**
   * RF46: Count generated, pending, approved, and edited feedbacks.
   * RF47: Calculate real-time percentages.
   */
  async getCourseStats(req, res, next) {
    try {
      const { courseId } = req.params;
      if (!courseId) {
        throw new AppError('courseId is mandatory', 400);
      }

      const assignmentId = req.query.assignmentId ? parseInt(req.query.assignmentId, 10) : null;
      const data = await this.statsService.getCourseStats(courseId, assignmentId);
      
      res.json({ exito: true, data });
    } catch (error) {
      next(error);
    }
  }

  /**
   * RF49: Grade distribution histogram.
   */
  async getGradeDistribution(req, res, next) {
    try {
      const { courseId } = req.params;
      const assignmentId = req.query.assignmentId ? parseInt(req.query.assignmentId, 10) : null;
      
      const data = await this.statsService.getGradeDistribution(courseId, assignmentId);
      res.json({ exito: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getStudentRatings(req, res, next) {
    try {
      const { courseId } = req.params;
      const assignmentId = req.query.assignmentId ? parseInt(req.query.assignmentId, 10) : null;
      
      const data = await this.statsService.getStudentRatingDistribution(courseId, assignmentId);
      res.json({ exito: true, data });
    } catch (error) {
      next(error);
    }
  }

  async exportCsv(req, res, next) {
    try {
      const { courseId } = req.params;
      const courseIdNum = courseId ? Number(courseId) : null;
      const data = await this.statsService.feedbackRepo.listAll(500, courseIdNum);
      
      let csv = 'ID,Student ID,Course ID,Assignment ID,Canvas Grade,Chile Grade,Status,Generation Date\n';
      data.forEach(row => {
        csv += `${row.id},${row.estudiante_id},${row.curso_id},${row.tarea_id},${row.nota_canvas},${row.nota_chile},${row.estado},${row.fecha_generacion}\n`;
      });

      res.header('Content-Type', 'text/csv');
      res.attachment(`feedback_export_${courseId || 'all'}.csv`);
      res.send(csv);
    } catch (error) {
      next(error);
    }
  }
}
