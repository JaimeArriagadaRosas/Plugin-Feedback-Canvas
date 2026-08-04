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
      // Simulación de llamada al sistema para obtener calificaciones pasadas.
      const mockGradesData = await this._fetchMockData(student.id);
      
      if (!mockGradesData) {
        return '';
      }

      const { hasGoodGrades } = mockGradesData;

      let description = '';
      if (hasGoodGrades) {
        description = 'El estudiante ha mantenido buenas calificaciones en los semestres anteriores.';
      } else {
        description = 'El estudiante ha tenido dificultades con sus calificaciones previamente.';
      }

      return this.sanitize(description);

    } catch (err) {
      logger.error(`[PreviousGradesResolver] Error resolviendo variable para ${student.id}: ${err.message}`);
      return ''; // Fallback silencioso
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
