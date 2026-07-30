import crypto from 'crypto';
import { verifyCanvasWebhook } from '../security/webhook.js';
import { isLocalModeAllowed } from '../security/envGuard.js';
import { getSecret, maskSecret } from '../config/secrets.js';
import { nowIso } from '../utils/datetime.js';
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
    const eventId = req.headers['x-canvas-event-id'] || '';
    const eventName = req.headers['x-canvas-event-name'] || req.body?.event_name || '';
    const eventHash = crypto.createHash('sha256')
      .update(JSON.stringify({ ...req.body, eventId, eventName }))
      .digest('hex');
    return { eventId, eventName, eventHash };
  }

  async _handleAttempts(eventHash, eventName, req, res) {
    const attempts = await this.webhookService.registrarEventoAtómico(eventHash, eventName);
    if (!attempts) {
      throw new AppError('No se pudo registrar el evento en DB', 500);
    }

    // Si el evento ya fue procesado (attempts > 1), devolver mensaje de idempotencia
    if (attempts > 1) {
      return res.status(202).json({ exito: true, mensaje: 'Evento ya procesado (idempotente)' });
    }

    const MAX_ATTEMPTS = 5;
    if (attempts > MAX_ATTEMPTS) {
      const yaEnDeadLetter = await this.webhookService.estaEnDeadLetter(eventHash);
      if (!yaEnDeadLetter) {
        await this.webhookService.moverADeadLetter(eventHash, eventName, req.body, 'Maximos reintentos excedidos', attempts);
      }
      return res.status(202).json({ exito: true, mensaje: 'Evento excedió reintentos máximos. Almacenado para revisión manual.' });
    }
    return null;
  }

  async _processGradeChange(payload, eventName, res) {
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
      return res.status(202).json({ exito: true, mensaje: 'Evento recibido y procesado (RF41)' });
    } catch (err) {
      logger.error(`[Webhook] Error en generación automática (RF41):`, { error: err.message });
      return res.status(500).json({ exito: false, error: { mensaje: 'Error procesando evento. Se reintentará.', codigo: 500 } });
    }
  }

  async handleWebhook(req, res, next) {
    try {
      if (!this.validarFirmaWebhook(req)) {
        throw new AppError('Firma de webhook inválida o secreto no configurado', 401);
      }

      const { eventId, eventName, eventHash } = this._extractEventData(req);

      if (!eventName) {
        throw new AppError(`Evento webhook sin nombre y cuerpo sin event_name`, 400);
      }

      const checkAttempts = await this._handleAttempts(eventHash, eventName, req, res);
      if (checkAttempts) return checkAttempts;

      if (eventName === 'grade_change' || eventName === 'submission_updated') {
        return this._processGradeChange(req.body, eventName, res);
      }

      res.status(200).json({ exito: true, mensaje: 'Evento ignorado' });
    } catch (error) {
      logger.error('[Webhook] Error procesando evento:', { error: error.message, stack: error.stack });
      if (error instanceof AppError) {
        return next(error);
      }
      return next(new AppError('Error interno procesando el webhook. Consulte los logs del servidor.', 500));
    }
  }
}
