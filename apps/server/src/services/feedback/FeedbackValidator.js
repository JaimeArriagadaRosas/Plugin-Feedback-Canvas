import logger from '../../utils/logger.js';

export default class FeedbackValidator {
  /**
   * Verifies business rules before generating feedback.
   * Returns an object with `{ isValid: boolean, skipData: object }`
   */
  static validateGeneration(existingFeedbacks, assignmentId, studentId, isRegenerate) {
    // Rule A: Never regenerate if it is already sent or approved
    const sentOrApproved = existingFeedbacks.find(
      fb => fb.tarea_id == assignmentId && (fb.estado === 'ENVIADO' || fb.estado === 'APROBADO')
    );
    
    if (sentOrApproved) {
      logger.debug(`[DEBUG] student ${studentId} skipped (sentOrApproved)`);
      return {
        isValid: false,
        skipData: { exito: false, omitido: true, data: null, mensaje: 'Feedback already sent or approved' }
      };
    }

    // Rule B: If it already has a draft, we only regenerate if the explicit intention was to regenerate
    const pending = existingFeedbacks.find(
      fb => fb.tarea_id == assignmentId && (fb.estado === 'PENDIENTE' || fb.estado === 'EDITADO' || !fb.estado)
    );
    
    if (pending && !isRegenerate) {
      logger.debug(`[DEBUG] student ${studentId} skipped (pending && !isRegenerate)`);
      return {
        isValid: false,
        skipData: { exito: false, omitido: true, data: null, mensaje: 'The student already has a draft and the action is not to force regeneration' }
      };
    }

    return { isValid: true };
  }
}
