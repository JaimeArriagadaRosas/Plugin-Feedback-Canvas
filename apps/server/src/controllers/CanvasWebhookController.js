import crypto from 'crypto';
import { verifyCanvasWebhook } from '../security/webhook.js';
import { getSecret } from '../config/secrets.js';
import logger from '../utils/logger.js';
import { AppError } from '../utils/errors.js';

export default class CanvasWebhookController {
  constructor(feedbackService, configRepo, webhookService) {
    this.feedbackService = feedbackService;
    this.configRepo = configRepo;
    this.webhookService = webhookService;
  }

  // _jsonError removido por refactorización hacia AppError

  validarFirmaWebhook(req) {
    const webhookSecret = getSecret('WEBHOOK_SECRET');

    if (!webhookSecret) {
      logger.error('WEBHOOK_SECRET not configured. Rejecting webhook for security (fail-closed).');
      return false;
    }

    const signature = req.headers['x-canvas-signature'];
    if (!signature) {
      logger.warn('Webhook rejected: Missing X-Canvas-Signature header');
      return false;
    }

    const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
    const match = verifyCanvasWebhook(rawBody, signature, webhookSecret);

    if (!match) {
      logger.warn('Webhook rejected: Invalid HMAC signature');
    }

    return match;
  }



  _extractEventData(req) {
    const eventId = req.headers['x-canvas-event-id']
      || req.body?.event_id
      || req.body?.id
      || null;
    const eventName = req.headers['x-canvas-event-name'] || req.body?.event_name || '';
    const eventHash = crypto.createHash('sha256')
      .update(JSON.stringify({ ...req.body, eventId, eventName }))
      .digest('hex');
    return { eventId, eventName, eventHash };
  }

  async _processGradeChange(payload, eventName) {
    const courseId = payload.course_id || (payload.data && payload.data.course_id);
    const assignmentId = payload.assignment_id || (payload.data && payload.data.assignment_id);
    const studentId = payload.user_id || (payload.data && payload.data.user_id);
    const rawGrade = payload.score ?? payload.grade ?? (payload.data && payload.data.score);
    const grade = (rawGrade === '' || rawGrade === null) ? undefined : Number(rawGrade);

    if (!courseId || !assignmentId || !studentId || grade === undefined || Number.isNaN(grade)) {
      throw new AppError(`Missing required fields in event_name=${eventName}: courseId=${courseId}, assignmentId=${assignmentId}, studentId=${studentId}, grade=${grade}`, 400);
    }

    const numericCourseId = Number(courseId);
    const numericAssignmentId = Number(assignmentId);
    const numericStudentId = Number(studentId);

    if (!Number.isInteger(numericCourseId) || numericCourseId < 1 ||
        !Number.isInteger(numericAssignmentId) || numericAssignmentId < 1 ||
        !Number.isInteger(numericStudentId) || numericStudentId < 1) {
      throw new AppError(`Invalid IDs in event_name=${eventName}: courseId=${courseId}, assignmentId=${assignmentId}, studentId=${studentId}`, 400);
    }

    logger.info(`[Webhook] Detected grade change for student ${studentId} in course ${courseId}, assignment ${assignmentId}. Grade: ${grade}`);

    let teacherId = null;
    let defaultTemplateId = 1;
    
    if (this.configRepo) {
      const config = await this.configRepo.getConfigAsignacion(courseId, assignmentId);
      if (config && config.profesor_id) {
        teacherId = config.profesor_id;
        defaultTemplateId = config.plantilla_id || 1;
      }
    }
    
    if (!teacherId) {
      logger.warn(`[Webhook] No teacher_id configured found for assignment ${assignmentId} in course ${courseId}.`);
      throw new AppError('Plugin not configured for this assignment (missing teacher_id)', 400);
    }

    try {
      await this.feedbackService.generateFeedback(courseId, assignmentId, studentId, defaultTemplateId, grade, teacherId);
      logger.info(`[Webhook] Successful automatic generation (RF41) for ${studentId}`);
      return { mensaje: 'Event received and processed (RF41)' };
    } catch (err) {
      logger.error(`[Webhook] Error in automatic generation (RF41):`, { error: err.message });
      throw new AppError('Error processing event. Will retry.', 500);
    }
  }

  async handleWebhook(req, res, next) {
    let eventHash = null;
    let eventName = '';
    let claimed = false;
    try {
      if (!this.validarFirmaWebhook(req)) {
        throw new AppError('Invalid webhook signature or secret not configured', 401);
      }

      const eventData = this._extractEventData(req);
      eventHash = eventData.eventHash;
      eventName = eventData.eventName;

      if (!eventName) {
        throw new AppError(`Webhook event without name and body without event_name`, 400);
      }

      const claim = await this.webhookService.claimEvent(eventHash, eventName);
      if (!claim.claimed) {
        const messages = {
          PROCESSED: 'Event already processed (idempotent)',
          PROCESSING: 'Event currently processing',
          DEAD_LETTER: 'Event stored for manual review'
        };
        return res.status(202).json({
          exito: true,
          mensaje: messages[claim.status] || 'Event not available for processing',
          estado: claim.status
        });
      }
      claimed = true;

      if (eventName === 'grade_change' || eventName === 'submission_updated') {
        const result = await this._processGradeChange(req.body, eventName);
        await this.webhookService.markProcessed(eventHash);
        return res.status(202).json({ exito: true, ...result });
      }

      await this.webhookService.markProcessed(eventHash);
      return res.status(200).json({ exito: true, mensaje: 'Event ignored' });
    } catch (error) {
      logger.error('[Webhook] Error processing event:', { error: error.message, stack: error.stack });
      if (claimed && eventHash) {
        try {
          const failure = await this.webhookService.markFailed(eventHash, error.message);
          if (failure.deadLetter) {
            await this.webhookService.moverADeadLetter(
              eventHash,
              eventName,
              req.body,
              error.message,
              failure.attempts
            );
            return res.status(202).json({
              exito: false,
              mensaje: 'Event exceeded maximum retries and was stored for manual review.'
            });
          }
        } catch (trackingError) {
          logger.error('[Webhook] Could not register event failure:', { error: trackingError.message, eventHash });
        }
      }
      if (error instanceof AppError) {
        return next(error);
      }
      return next(new AppError('Internal error processing the webhook. Check server logs.', 500));
    }
  }
}
