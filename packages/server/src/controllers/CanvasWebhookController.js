import crypto from 'crypto';
import db from '../data/db.js';
import { verifyCanvasWebhook } from '../security/webhook.js';
import { isLocalModeAllowed } from '../security/envGuard.js';
import { getSecret, maskSecret } from '../config/secrets.js';
import { nowIso } from '../utils/datetime.js';
import logger from '../utils/logger.js';

export default class CanvasWebhookController {
  constructor(feedbackService, configRepo) {
    this.feedbackService = feedbackService;
    this.configRepo = configRepo;
  }

  _jsonError(res, statusCode, message) {
    return res.status(statusCode).json({
      exito: false,
      error: {
        codigo: statusCode,
        mensaje: message,
        timestamp: nowIso(),
        path: res.req?.originalUrl || ''
      }
    });
  }

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

  async _registrarEventoAtómico(eventHash, eventType) {
    try {
      const result = await db.query(
        `INSERT INTO webhook_events (event_hash, event_type, attempts) VALUES ($1, $2, 1)
         ON CONFLICT (event_hash) DO UPDATE SET attempts = webhook_events.attempts + 1
         RETURNING attempts`,
        [eventHash, eventType]
      );
      return result.rows[0].attempts;
    } catch (err) {
      logger.error('[Webhook] Error registrando evento en DB (idempotencia):', { error: err.message });
      return null;
    }
  }

  async _moverADeadLetter(eventHash, eventType, payload, lastError, attempts) {
    try {
      await db.query(
        `INSERT INTO webhook_dead_letter (event_hash, event_type, payload, last_error, attempts)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (event_hash) DO NOTHING`,
        [eventHash, eventType, JSON.stringify(payload), lastError, attempts]
      );
      logger.warn(`[Webhook] Evento movido a dead-letter: ${eventHash}`);
    } catch (err) {
      logger.error('[Webhook] Error moviendo evento a dead-letter:', { error: err.message });
    }
  }

  async _estaEnDeadLetter(eventHash) {
    try {
      const result = await db.query(
        'SELECT 1 FROM webhook_dead_letter WHERE event_hash = $1 LIMIT 1',
        [eventHash]
      );
      return result.rowCount > 0;
    } catch {
      return false;
    }
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
    const attempts = await this._registrarEventoAtómico(eventHash, eventName);
    if (!attempts) {
      return this._jsonError(res, 500, 'No se pudo registrar el evento en DB');
    }

    const MAX_ATTEMPTS = 5;
    if (attempts > MAX_ATTEMPTS) {
      const yaEnDeadLetter = await this._estaEnDeadLetter(eventHash);
      if (!yaEnDeadLetter) {
        await this._moverADeadLetter(eventHash, eventName, req.body, 'Maximos reintentos excedidos', attempts);
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
      return this._jsonError(res, 400, `Campos requeridos faltantes en event_name=${eventName}: courseId=${courseId}, assignmentId=${assignmentId}, studentId=${studentId}, grade=${grade}`);
    }

    const numericCourseId = Number(courseId);
    const numericAssignmentId = Number(assignmentId);
    const numericStudentId = Number(studentId);

    if (!Number.isInteger(numericCourseId) || numericCourseId < 1 ||
        !Number.isInteger(numericAssignmentId) || numericAssignmentId < 1 ||
        !Number.isInteger(numericStudentId) || numericStudentId < 1) {
      return this._jsonError(res, 400, `IDs inválidos en event_name=${eventName}: courseId=${courseId}, assignmentId=${assignmentId}, studentId=${studentId}`);
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
      return this._jsonError(res, 400, 'Plugin no configurado para esta tarea (falta profesor_id)');
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
        return this._jsonError(res, 401, 'Firma de webhook inválida o secreto no configurado');
      }

      const { eventId, eventName, eventHash } = this._extractEventData(req);

      if (!eventName) {
        return this._jsonError(res, 400, `Evento webhook sin nombre y cuerpo sin event_name`);
      }

      const checkAttempts = await this._handleAttempts(eventHash, eventName, req, res);
      if (checkAttempts) return checkAttempts;

      if (eventName === 'grade_change' || eventName === 'submission_updated') {
        return this._processGradeChange(req.body, eventName, res);
      }

      res.status(200).json({ exito: true, mensaje: 'Evento ignorado' });
    } catch (error) {
      logger.error('[Webhook] Error procesando evento:', { error: error.message, stack: error.stack });
      return this._jsonError(res, 500, 'Error interno procesando el webhook. Consulte los logs del servidor.');
    }
  }
}
