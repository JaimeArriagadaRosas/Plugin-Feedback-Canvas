import BaseVariableResolver from './BaseVariableResolver.js';
import CourseStatisticsService from '../CourseStatisticsService.js';
import logger from '../../utils/logger.js';

export default class CourseAverageResolver extends BaseVariableResolver {
  constructor(canvasGateway, courseStatisticsService = null) {
    super('{{promedio_curso}}');
    this.canvasGateway = canvasGateway;
    this.courseStatisticsService = courseStatisticsService || new CourseStatisticsService(canvasGateway);
  }

  async resolve(context) {
    const { courseId, assignmentId, teacherToken } = context;
    if (!courseId || !assignmentId) {
      return 'un promedio no calculado';
    }

    try {
      const stats = await this.courseStatisticsService.getAssignmentStats(courseId, assignmentId, teacherToken);
      
      if (!stats) return 'un promedio no calculado';

      if (stats.score) {
        const formattedScore = Number(parseFloat(stats.score).toFixed(1));
        return this.sanitize(`un puntaje promedio de ${formattedScore}`);
      }
      if (stats.grade) {
        const formattedGrade = Number(parseFloat(stats.grade).toFixed(1));
        return this.sanitize(`una nota promedio de ${formattedGrade}`);
      }
      return 'un promedio no calculado';
    } catch (error) {
      logger.warn(`[CourseAverageResolver] Error resolviendo promedio: ${error.message}`);
      return 'un promedio no calculado';
    }
  }
}
