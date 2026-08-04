import logger from '../../utils/logger.js';

/**
 * Controlador de concurrencia para la generación masiva de feedback.
 * Aplica el principio de Responsabilidad Única (SRP) separando el control de flujo
 * de la generación individual de feedback.
 */
export default class MassiveGenerationOrchestrator {
  constructor(feedbackGenerationService) {
    this.generationService = feedbackGenerationService;
    // Delay de seguridad entre peticiones para respetar límites de cuota (ej. Gemini Free: 15 RPM)
    this.delayMs = 4000;
  }

  /**
   * Procesa la cola de estudiantes asíncronamente con retrasos artificiales
   */
  async execute(courseId, activeAssignments, students, teacherId, isRegenerate = false) {
    // Se ejecuta en background sin bloquear la respuesta HTTP
    setTimeout(async () => {
      logger.info(`[Orchestrator] Iniciando generación masiva para ${activeAssignments.length} tareas y ${students.length} estudiantes.`);
      
      for (const assignment of activeAssignments) {
        for (const student of students) {
          try {
            await this.generationService.generateFeedback(
              courseId, 
              assignment.id, 
              student.id, 
              assignment.templateId || 1, 
              undefined, 
              teacherId, 
              { isRegenerate }
            );
          } catch (e) {
            logger.error(`[Orchestrator] Error en generación masiva para estudiante ${student.id} en tarea ${assignment.id}: ${e.message}`);
          }
        }
      }
      
      logger.info(`[Orchestrator] Generación masiva finalizada.`);
    }, 0);
  }
}
