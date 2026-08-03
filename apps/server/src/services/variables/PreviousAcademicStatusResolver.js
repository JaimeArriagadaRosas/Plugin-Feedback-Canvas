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
      // Simulación de llamada a la base de datos de historia académica.
      // Comportamiento Fallback: si no hay datos, retornamos string vacío (se ignora en el prompt).
      const mockStatusData = await this._fetchMockData(student.id);
      
      if (!mockStatusData) {
        return '';
      }

      const { status } = mockStatusData;
      if (!status) return '';

      let description = '';
      if (status === 'regular') description = 'Alumno regular sin riesgo académico histórico.';
      else if (status === 'risk') description = 'El estudiante ha presentado riesgo académico o reprobación de asignaturas en semestres anteriores.';
      else if (status === 'outstanding') description = 'El estudiante ha tenido un rendimiento histórico destacado en semestres previos.';

      return this.sanitize(description);

    } catch (err) {
      logger.error(`[PreviousAcademicStatusResolver] Error resolviendo variable para ${student.id}: ${err.message}`);
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
        
        if (isNaN(idLastDigit) || idLastDigit % 5 === 0) {
           return resolve(null); // Caso sin datos (Fallback test)
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
