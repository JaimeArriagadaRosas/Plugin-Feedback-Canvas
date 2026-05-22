/**
 * Servicio de Historial Académico
 * Coordina la obtención de datos de Canvas y la persistencia local del historial.
 */
export default class AcademicHistoryService {
  constructor(canvasService, studentRepo) {
    this.canvasService = canvasService;
    this.studentRepo = studentRepo;
  }

  /**
   * Obtiene y procesa el historial de un estudiante en un curso
   */
  async getStudentAcademicProfile(courseId, studentId) {
    // 1. Intentar obtener de cache local
    let history = await this.studentRepo.getHistory(studentId, courseId);

    if (!history) {
      console.log(`[HISTORY] Sincronizando historial de Canvas para Estudiante:${studentId}`);
      // 2. Si no hay cache, traer de Canvas (simulación de múltiples tareas)
      const enrollments = await this.canvasService.getStudentGrades(courseId, studentId);
      
      // Procesar datos crudos de Canvas
      history = enrollments.map(e => ({
        grade: e.grades?.current_score || 0,
        date: new Date().toISOString()
      }));

      // 3. Guardar en cache
      await this.studentRepo.updateHistory(studentId, courseId, history);
    }

    return history;
  }
}
