import logger from '../../utils/logger.js';

export default class MessageFacade {
  constructor(adapter) {
    this.adapter = adapter;
  }

  async pushInAppMessage(courseId, studentId, teacherId, subject, bodyText) {
    logger.info(`[CanvasLmsAdapter] Enviando mensaje In-App a ${studentId} por profesor ${teacherId}`);
    // No hay verificación GET idempotente clara para conversaciones, 
    // pero el IdempotencyKeyManager a nivel controlador nos protege de duplicados
    return this.adapter._fetchWithToken(`/conversations`, teacherId, {
      method: 'POST',
      body: JSON.stringify({
        recipients: [studentId],
        subject: subject,
        body: bodyText,
        context_code: `course_${courseId}`,
        force_new: true
      })
    });
  }
}
