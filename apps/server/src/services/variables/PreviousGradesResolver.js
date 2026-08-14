import BaseVariableResolver from './BaseVariableResolver.js';
import logger from '../../utils/logger.js';

export default class PreviousGradesResolver extends BaseVariableResolver {
  constructor() {
    super('{{calificaciones_previas}}');
  }

  async resolve(context) {
    const { student } = context;
    if (!student || !student.id) return '';

    try {
      // Simulation of call to the system to get past grades.
      const mockGradesData = await this._fetchMockData(student.id);
      
      if (!mockGradesData) {
        return '';
      }

      const { hasGoodGrades } = mockGradesData;

      let description = '';
      if (hasGoodGrades) {
        description = 'The student has maintained good grades in previous semesters.';
      } else {
        description = 'The student has had difficulties with their grades previously.';
      }

      return this.sanitize(description);

    } catch (err) {
      logger.error(`[PreviousGradesResolver] Error resolving variable for ${student.id}: ${err.message}`);
      return ''; // Silent fallback
    }
  }

  async _fetchMockData(studentId) {
    return new Promise(resolve => {
      setTimeout(() => {
        const idLastDigit = parseInt(String(studentId).slice(-1), 10);
        
        if (isNaN(idLastDigit) || idLastDigit % 4 === 0) {
           return resolve(null);
        }

        resolve({
          studentId,
          hasGoodGrades: (idLastDigit % 2 === 0)
        });
      }, 100);
    });
  }
}
