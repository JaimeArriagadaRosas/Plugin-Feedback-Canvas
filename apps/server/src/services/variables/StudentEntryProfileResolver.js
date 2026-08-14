import BaseVariableResolver from './BaseVariableResolver.js';
import logger from '../../utils/logger.js';

export default class StudentEntryProfileResolver extends BaseVariableResolver {
  constructor() {
    super('{{perfil_ingreso}}');
  }

  async resolve(context) {
    const { student } = context;
    if (!student || !student.id) return '';

    try {
      // Simulation of call to the university admissions database.
      // Fallback behavior: if there is no data, return empty string (ignored in the prompt).
      const mockAdmissionsData = await this._fetchMockData(student.id);
      
      if (!mockAdmissionsData) {
        return '';
      }

      const { isFirstGeneration, highSchoolType } = mockAdmissionsData;

      let description = 'The student comes from a ' + (highSchoolType || 'private') + ' high school.';
      if (isFirstGeneration) {
        description += ' Additionally, they are first-generation in higher education in their family.';
      }

      return this.sanitize(description);

    } catch (err) {
      logger.error(`[StudentEntryProfileResolver] Error resolving variable for ${student.id}: ${err.message}`);
      return ''; // Silent fallback
    }
  }

  async _fetchMockData(studentId) {
    // Simulate network latency
    return new Promise(resolve => {
      setTimeout(() => {
        // In production, a fetch() to the real admissions API would be made here.
        // We will simulate some cases according to the last digit of studentId.
        const idLastDigit = parseInt(String(studentId).slice(-1), 10);
        
        if (isNaN(idLastDigit) || idLastDigit % 4 === 0) {
           return resolve(null); // Case without data (Fallback test)
        }

        resolve({
          studentId,
          isFirstGeneration: (idLastDigit % 2 === 0),
          highSchoolType: (idLastDigit <= 3) ? 'public' : 'subsidized'
        });
      }, 100);
    });
  }
}
