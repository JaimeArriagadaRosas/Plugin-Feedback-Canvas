import BaseVariableResolver from './BaseVariableResolver.js';
import logger from '../../utils/logger.js';

export default class OtherCoursePerformanceResolver extends BaseVariableResolver {
  constructor() {
    super('{{other_course_performance}}');
  }

  async resolve(context) {
    const { student } = context;
    if (!student || !student.id) return '';

    try {
      // Simulation of university SIS call.
      // Fallback behavior: if there is no data, return empty string (ignored in the prompt).
      const mockSISData = await this._fetchMockData(student.id);
      
      if (!mockSISData) {
        return '';
      }

      const { averageOtherCourses } = mockSISData;
      if (!averageOtherCourses) return '';

      const numericAverage = parseFloat(averageOtherCourses);
      if (isNaN(numericAverage)) return '';

      let qualitativeDesc = '';
      if (numericAverage >= 5.5) qualitativeDesc = 'very good';
      else if (numericAverage >= 4.0) qualitativeDesc = 'average';
      else qualitativeDesc = 'with difficulties';

      return this.sanitize(`In the rest of their courses this semester, the student shows a ${qualitativeDesc} performance (average ${numericAverage.toFixed(1)}).`);

    } catch (err) {
      logger.error(`[OtherCoursePerformanceResolver] Error resolving variable for ${student.id}: ${err.message}`);
      return ''; // Silent fallback
    }
  }

  async _fetchMockData(studentId) {
    // Simulate network latency
    return new Promise(resolve => {
      setTimeout(() => {
        // In production, a fetch() to the real API would be made here.
        // We will simulate some cases according to the last digit of studentId.
        const idLastDigit = parseInt(String(studentId).slice(-1), 10);
        
        if (isNaN(idLastDigit) || idLastDigit % 3 === 0) {
           return resolve(null); // Case without data in the SIS (Fallback test)
        }

        resolve({
          studentId,
          averageOtherCourses: (idLastDigit <= 3) ? 6.2 : ((idLastDigit <= 6) ? 4.8 : 3.5)
        });
      }, 100);
    });
  }
}
