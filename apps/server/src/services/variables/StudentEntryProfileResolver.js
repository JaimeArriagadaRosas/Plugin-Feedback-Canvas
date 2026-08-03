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
      // Simulación de llamada a la base de datos de admisión de la universidad.
      // Comportamiento Fallback: si no hay datos, retornamos string vacío (se ignora en el prompt).
      const mockAdmissionsData = await this._fetchMockData(student.id);
      
      if (!mockAdmissionsData) {
        return '';
      }

      const { isFirstGeneration, highSchoolType } = mockAdmissionsData;

      let description = 'El estudiante proviene de un establecimiento educativo de tipo ' + (highSchoolType || 'particular') + '.';
      if (isFirstGeneration) {
        description += ' Además, es primera generación en la educación superior en su familia.';
      }

      return this.sanitize(description);

    } catch (err) {
      logger.error(`[StudentEntryProfileResolver] Error resolviendo variable para ${student.id}: ${err.message}`);
      return ''; // Fallback silencioso
    }
  }

  async _fetchMockData(studentId) {
    // Simular latencia de red
    return new Promise(resolve => {
      setTimeout(() => {
        // En producción, aquí se haría un fetch() al API real de admisión.
        // Simularemos algunos casos según el último dígito del studentId.
        const idLastDigit = parseInt(String(studentId).slice(-1), 10);
        
        if (isNaN(idLastDigit) || idLastDigit % 4 === 0) {
           return resolve(null); // Caso sin datos (Fallback test)
        }

        resolve({
          studentId,
          isFirstGeneration: (idLastDigit % 2 === 0),
          highSchoolType: (idLastDigit <= 3) ? 'público' : 'subvencionado'
        });
      }, 100);
    });
  }
}
