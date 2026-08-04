import logger from '../../utils/logger.js';

export default class FeedbackValidator {
  /**
   * Verifica las reglas de negocio antes de generar un feedback.
   * Retorna un objeto con `{ isValid: boolean, skipData: object }`
   */
  static validateGeneration(existingFeedbacks, assignmentId, studentId, isRegenerate) {
    // Regla A: Jamás regenerar si ya está enviado o aprobado
    const sentOrApproved = existingFeedbacks.find(
      fb => fb.tarea_id == assignmentId && (fb.estado === 'ENVIADO' || fb.estado === 'APROBADO')
    );
    
    if (sentOrApproved) {
      logger.debug(`[DEBUG] student ${studentId} skipped (sentOrApproved)`);
      return {
        isValid: false,
        skipData: { exito: false, omitido: true, data: null, mensaje: 'Feedback ya enviado o aprobado' }
      };
    }

    // Regla B: Si ya tiene borrador, solo regeneramos si la intención explícita era regenerar
    const pending = existingFeedbacks.find(
      fb => fb.tarea_id == assignmentId && (fb.estado === 'PENDIENTE' || fb.estado === 'EDITADO' || !fb.estado)
    );
    
    if (pending && !isRegenerate) {
      logger.debug(`[DEBUG] student ${studentId} skipped (pending && !isRegenerate)`);
      return {
        isValid: false,
        skipData: { exito: false, omitido: true, data: null, mensaje: 'El estudiante ya tiene un borrador y la acción no es forzar regeneración' }
      };
    }

    return { isValid: true };
  }
}
