import logger from '../utils/logger.js';

export default class StatsService {
  constructor(feedbackRepo) {
    this.feedbackRepo = feedbackRepo;
  }

  async getCourseStats(courseId, assignmentId) {
    logger.debug('[StatsService] Obteniendo estadísticas', { courseId, assignmentId });
    const stats = await this.feedbackRepo.getStats(courseId, assignmentId);
    
    let total = 0;
    const byStatus = {
      PENDIENTE: 0,
      EDITADO: 0,
      APROBADO: 0,
      ENVIADO: 0,
      RECHAZADO: 0
    };

    stats.forEach(row => {
      const count = parseInt(row.total, 10);
      const status = row.estado || 'PENDIENTE';
      total += count;
      // eslint-disable-next-line security/detect-object-injection
      // eslint-disable-next-line security/detect-object-injection
      byStatus[status] = (byStatus[status] || 0) + count;
    });

    const percentages = {};
    if (total > 0) {
      for (const [status, count] of Object.entries(byStatus)) {
        // eslint-disable-next-line security/detect-object-injection
        percentages[status] = Math.round((count / total) * 100);
      }
    }

    return { total, byStatus, percentages };
  }

  async getGradeDistribution(courseId, assignmentId) {
    logger.debug('[StatsService] Obteniendo distribución de notas', { courseId, assignmentId });
    const distribution = await this.feedbackRepo.getGradeDistribution(courseId, assignmentId);
    
    // Group grades in bins or return as is.
    // Assuming nota_chile goes from 1.0 to 7.0
    return distribution;
  }

  async getStudentRatingDistribution(courseId, assignmentId) {
    logger.debug('[StatsService] Obteniendo distribución de calificaciones de estudiantes', { courseId, assignmentId });
    return this.feedbackRepo.getStudentRatingDistribution(courseId, assignmentId);
  }
}
