/**
 * Controlador de Estadísticas (RF46, RF47, RF48, RF49)
 *
 * Expone endpoints para obtener conteos, histogramas de calificaciones
 * y distribución de feedback, usados en el Panel del Docente y Administrador.
 */
import { AppError } from '../utils/errors.js';

export default class StatsController {
  constructor(statsService) {
    this.statsService = statsService;
  }

  /**
   * RF46: Contabilizar feedbacks generados, pendientes, aprobados, editados.
   * RF47: Calcular porcentajes en tiempo real.
   */
  async getCourseStats(req, res, next) {
    try {
      const { courseId } = req.params;
      if (!courseId) {
        throw new AppError('El courseId es obligatorio', 400);
      }

      const assignmentId = req.query.assignmentId ? parseInt(req.query.assignmentId, 10) : null;
      const data = await this.statsService.getCourseStats(courseId, assignmentId);
      
      res.json({ exito: true, data });
    } catch (error) {
      next(error);
    }
  }

  /**
   * RF49: Histograma de distribución de calificaciones.
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
      
      let csv = 'ID,Estudiante ID,Curso ID,Tarea ID,Nota Canvas,Nota Chile,Estado,Fecha Generacion\n';
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
