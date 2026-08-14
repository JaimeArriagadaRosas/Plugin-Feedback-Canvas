import BaseVariableResolver from './BaseVariableResolver.js';
import logger from '../../utils/logger.js';

export default class PreviousAcademicStatusResolver extends BaseVariableResolver {
  constructor() {
    super('{{situacion_academica_anterior}}');
  }

  async resolve(context) {
    const { student } = context;
    if (!student || !student.id) return '';

    try {
      // Simulation of call to academic history database.
      // Fallback behavior: if there is no data, return empty string (ignored in the prompt).
      const mockStatusData = await this._fetchMockData(student.id);
      
      if (!mockStatusData) {
        return '';
      }

      const { status } = mockStatusData;
      if (!status) return '';

      let description = '';
      if (status === 'regular') description = 'Regular student without historical academic risk.';
      else if (status === 'risk') description = 'The student has presented academic risk or failed courses in previous semesters.';
      else if (status === 'outstanding') description = 'The student has had outstanding historical performance in previous semesters.';

      return this.sanitize(description);

    } catch (err) {
      logger.error(`[PreviousAcademicStatusResolver] Error resolving variable for ${student.id}: ${err.message}`);
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
        
        if (isNaN(idLastDigit) || idLastDigit % 5 === 0) {
           return resolve(null); // Case without data (Fallback test)
        }

        let status = 'regular';
        if (idLastDigit <= 2) status = 'risk';
        else if (idLastDigit >= 8) status = 'outstanding';

        resolve({
          studentId,
          status
        });
      }, 100);
    });
  }
}
