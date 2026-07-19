import logger from '../utils/logger.js';
import { nowIso } from '../utils/datetime.js';

/**
 * Servicio de Historial Académico
 * Coordina la obtención de datos de Canvas y la persistencia local del historial.
 */
export default class AcademicHistoryService {
  constructor(canvasGateway, studentRepo) {
    this.canvasGateway = canvasGateway;
    this.studentRepo = studentRepo;
  }

  /**
   * Obtiene y procesa el historial de un estudiante en un curso específico.
   * Si no existe, lanza un lazy load en background.
   */
  async getStudentAcademicProfile(courseId, studentId, teacherToken = null) {
    // 1. Intentar obtener de cache local
    let history = await this.studentRepo.getHistory(studentId, courseId);

    if (!history || history.length === 0) {
      logger.info(`[HISTORY] Cache vacío. Lanzando sincronización lazy para Estudiante:${studentId}`);
      // Iniciamos la carga en segundo plano para no bloquear el request actual
      this.syncStudentHistoryLazy(courseId, studentId, teacherToken);
      return { status: 'loading', message: 'El perfil académico se está sincronizando en segundo plano.' };
    }

    return history;
  }

  /**
   * Proceso de carga diferida (Lazy Loading) del historial del estudiante.
   * Escanea otros cursos (simulado/real) para recopilar el perfil completo (RF34/35).
   */
  async syncStudentHistoryLazy(courseId, studentId, teacherToken = null) {
    logger.info(`[HISTORY-LAZY] Iniciando escaneo de historial para estudiante ${studentId}.`);
    
    // Estimación: asumiendo 4 cursos por estudiante con un costo de 1.2s por llamada a Canvas
    const estimatedCourses = 4;
    const estimatedTimeSec = (estimatedCourses * 1.2).toFixed(1);
    logger.info(`[HISTORY-LAZY] Estimación: se escanearán ~${estimatedCourses} cursos. Tiempo estimado: ${estimatedTimeSec}s.`);

    // Ejecutar en background sin bloquear el hilo principal (Fire and Forget)
    Promise.resolve().then(async () => {
      try {
        // En producción: this.canvasService.getStudentEnrollments(studentId, teacherToken)
        // Por ahora simulamos la carga pesada o usamos la carga del curso actual como fallback
        
        let enrollments = [];
        try {
          enrollments = await this.canvasGateway.getStudentGrades(courseId, studentId, teacherToken);
        } catch (canvasErr) {
          logger.warn(`[HISTORY-LAZY] No se pudo obtener de Canvas. Error: ${canvasErr.message}`);
        }

        // Simular el retraso del escaneo de múltiples cursos
        await new Promise(resolve => setTimeout(resolve, estimatedTimeSec * 1000));

        // Procesar datos crudos
        const history = enrollments.length > 0 ? enrollments.map(e => ({
          grade: e.grades?.current_score || 0,
          date: nowIso()
        })) : [{ grade: 0, date: nowIso(), fallback: true }]; // Fallback dummy

        // Guardar en cache
        await this.studentRepo.updateHistory(studentId, courseId, history);
        logger.info(`[HISTORY-LAZY] Carga completada y cacheada para estudiante ${studentId}.`);
        
      } catch (error) {
        logger.error(`[HISTORY-LAZY] Fallo crítico durante la sincronización lazy:`, error);
      }
    });

    return { status: 'started' };
  }
}
