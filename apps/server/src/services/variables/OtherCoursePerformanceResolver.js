import BaseVariableResolver from './BaseVariableResolver.js';
import logger from '../../utils/logger.js';

export default class OtherCoursePerformanceResolver extends BaseVariableResolver {
  constructor() {
    super('{{desempeno_otras_asignaturas}}');
  }

  async resolve(context) {
    const { student } = context;
    if (!student || !student.id) return '';

    try {
      // Simulación de llamada al SIS de la universidad.
      // Comportamiento Fallback: si no hay datos, retornamos string vacío (se ignora en el prompt).
      const mockSISData = await this._fetchMockData(student.id);
      
      if (!mockSISData) {
        return '';
      }

      const { averageOtherCourses } = mockSISData;
      if (!averageOtherCourses) return '';

      const numericAverage = parseFloat(averageOtherCourses);
      if (isNaN(numericAverage)) return '';

      let qualitativeDesc = '';
      if (numericAverage >= 5.5) qualitativeDesc = 'muy bueno';
      else if (numericAverage >= 4.0) qualitativeDesc = 'promedio regular';
      else qualitativeDesc = 'con dificultades';

      return this.sanitize(`En el resto de sus asignaturas este semestre, el estudiante presenta un rendimiento ${qualitativeDesc} (promedio ${numericAverage.toFixed(1)}).`);

    } catch (err) {
      logger.error(`[OtherCoursePerformanceResolver] Error resolviendo variable para ${student.id}: ${err.message}`);
      return ''; // Fallback silencioso
    }
  }

  async _fetchMockData(studentId) {
    // Simular latencia de red
    return new Promise(resolve => {
      setTimeout(() => {
        // En producción, aquí se haría un fetch() al API real.
        // Simularemos algunos casos según el último dígito del studentId.
        const idLastDigit = parseInt(String(studentId).slice(-1), 10);
        
        if (isNaN(idLastDigit) || idLastDigit % 3 === 0) {
           return resolve(null); // Caso sin datos en el SIS (Fallback test)
        }

        resolve({
          studentId,
          averageOtherCourses: (idLastDigit <= 3) ? 6.2 : ((idLastDigit <= 6) ? 4.8 : 3.5)
        });
      }, 100);
    });
  }
}
