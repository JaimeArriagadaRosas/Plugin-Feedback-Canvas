import BaseVariableResolver from './BaseVariableResolver.js';
import CourseStatisticsService from '../CourseStatisticsService.js';
import logger from '../../utils/logger.js';

export default class CourseAverageResolver extends BaseVariableResolver {
  constructor(canvasGateway, courseStatisticsService = null) {
    super('{{course_average}}');
    this.canvasGateway = canvasGateway;
    this.courseStatisticsService = courseStatisticsService || new CourseStatisticsService(canvasGateway);
  }

  async resolve(context) {
    const { courseId, assignmentId, teacherToken } = context;
    if (!courseId || !assignmentId) {
      return 'an uncalculated average';
    }

    try {
      const stats = await this.courseStatisticsService.getAssignmentStats(courseId, assignmentId, teacherToken);
      
      if (!stats) return 'an uncalculated average';

      if (stats.score) {
        const parsedScore = parseFloat(stats.score);
        if (!isNaN(parsedScore)) {
          const formattedScore = Number(parsedScore.toFixed(1));
          return this.sanitize(`an average score of ${formattedScore}`);
        }
      }
      if (stats.grade) {
        const parsedGrade = parseFloat(stats.grade);
        if (!isNaN(parsedGrade)) {
          const formattedGrade = Number(parsedGrade.toFixed(1));
          return this.sanitize(`an average grade of ${formattedGrade}`);
        }
      }
      return 'an uncalculated average';
    } catch (error) {
      logger.warn(`[CourseAverageResolver] Error resolving average: ${error.message}`);
      return 'an uncalculated average';
    }
  }
}
