import logger from '../../utils/logger.js';

export default class MessageFacade {
  constructor(adapter) {
    this.adapter = adapter;
  }

  async pushInAppMessage(courseId, studentId, teacherId, subject, bodyText) {
    logger.info(`[CanvasLmsAdapter] Sending In-App message to ${studentId} by teacher ${teacherId}`);
    // There is no clear idempotent GET verification for conversations, 
    // but the IdempotencyKeyManager at controller level protects us from duplicates
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
