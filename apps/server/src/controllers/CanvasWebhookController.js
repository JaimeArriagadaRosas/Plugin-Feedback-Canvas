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
      logger.error('WEBHOOK_SECRET no configurado. Rechazando webhook por seguridad (fail-closed).');
      return false;
    }

    const signature = req.headers['x-canvas-signature'];
    if (!signature) {
      logger.warn('Webhook rechazado: Falta cabecera X-Canvas-Signature');
      return false;
    }

    const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
    const match = verifyCanvasWebhook(rawBody, signature, webhookSecret);

    if (!match) {
      logger.warn('Webhook rechazado: Firma HMAC inválida');
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
      throw new AppError(`Campos requeridos faltantes en event_name=${eventName}: courseId=${courseId}, assignmentId=${assignmentId}, studentId=${studentId}, grade=${grade}`, 400);
    }

    const numericCourseId = Number(courseId);
    const numericAssignmentId = Number(assignmentId);
    const numericStudentId = Number(studentId);

    if (!Number.isInteger(numericCourseId) || numericCourseId < 1 ||
        !Number.isInteger(numericAssignmentId) || numericAssignmentId < 1 ||
        !Number.isInteger(numericStudentId) || numericStudentId < 1) {
      throw new AppError(`IDs inválidos en event_name=${eventName}: courseId=${courseId}, assignmentId=${assignmentId}, studentId=${studentId}`, 400);
    }

    logger.info(`[Webhook] Detectado cambio de nota para estudiante ${studentId} en curso ${courseId}, tarea ${assignmentId}. Nota: ${grade}`);

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
      logger.warn(`[Webhook] No se encontró profesor_id configurado para la tarea ${assignmentId} en el curso ${courseId}.`);
      throw new AppError('Plugin no configurado para esta tarea (falta profesor_id)', 400);
    }

    try {
      await this.feedbackService.generateFeedback(courseId, assignmentId, studentId, defaultTemplateId, grade, teacherId);
      logger.info(`[Webhook] Generación automática exitosa (RF41) para ${studentId}`);
      return { mensaje: 'Evento recibido y procesado (RF41)' };
    } catch (err) {
      logger.error(`[Webhook] Error en generación automática (RF41):`, { error: err.message });
      throw new AppError('Error procesando evento. Se reintentará.', 500);
    }
  }

  async handleWebhook(req, res, next) {
    let eventHash = null;
    let eventName = '';
    let claimed = false;
    try {
      if (!this.validarFirmaWebhook(req)) {
        throw new AppError('Firma de webhook inválida o secreto no configurado', 401);
      }

      const eventData = this._extractEventData(req);
      eventHash = eventData.eventHash;
      eventName = eventData.eventName;

      if (!eventName) {
        throw new AppError(`Evento webhook sin nombre y cuerpo sin event_name`, 400);
      }

      const claim = await this.webhookService.claimEvent(eventHash, eventName);
      if (!claim.claimed) {
        const messages = {
          PROCESSED: 'Evento ya procesado (idempotente)',
          PROCESSING: 'Evento actualmente en proceso',
          DEAD_LETTER: 'Evento almacenado para revisión manual'
        };
        return res.status(202).json({
          exito: true,
          mensaje: messages[claim.status] || 'Evento no disponible para procesamiento',
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
      return res.status(200).json({ exito: true, mensaje: 'Evento ignorado' });
    } catch (error) {
      logger.error('[Webhook] Error procesando evento:', { error: error.message, stack: error.stack });
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
              mensaje: 'Evento excedió reintentos máximos y fue almacenado para revisión manual.'
            });
          }
        } catch (trackingError) {
          logger.error('[Webhook] No se pudo registrar el fallo del evento:', { error: trackingError.message, eventHash });
        }
      }
      if (error instanceof AppError) {
        return next(error);
      }
      return next(new AppError('Error interno procesando el webhook. Consulte los logs del servidor.', 500));
    }
  }
}
