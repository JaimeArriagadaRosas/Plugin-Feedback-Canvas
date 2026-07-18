import crypto from 'crypto';
import db from '../data/db.js';
import { verifyCanvasWebhook } from '../security/webhook.js';
import { isLocalModeAllowed } from '../security/envGuard.js';
import { getSecret, maskSecret } from '../config/secrets.js';
import { nowIso } from '../utils/datetime.js';
import logger from '../utils/logger.js';

export default class CanvasWebhookController {
  constructor(feedbackService) {
    this.feedbackService = feedbackService;
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

    if (isLocalModeAllowed() || process.env.NODE_ENV === 'test') {
      logger.debug('Modo local/test detectado. Omitiendo validaciÃ³n de firma de webhook.', {
        webhookSecretConfigurado: !!webhookSecret,
        muestra: maskSecret(webhookSecret),
      });
      return true;
    }

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
        'INSERT INTO webhook_events (event_hash, event_type) VALUES ($1, $2) ON CONFLICT (event_hash) DO NOTHING RETURNING event_hash',
        [eventHash, eventType]
      );
      return result.rowCount > 0; // True si insertó (nuevo), False si ya existía
    } catch (err) {
      logger.warn('[Webhook] Error registrando evento atómico:', { error: err.message });
      // Fail closed para evitar duplicados si hay un error de conexión transitorio
      return false;
    }
  }

  async handleWebhook(req, res, next) {
    try {
      if (!this.validarFirmaWebhook(req)) {
        return this._jsonError(res, 401, 'Firma de webhook inválida o secreto no configurado');
      }

      const eventId = req.headers['x-canvas-event-id'] || '';
      const eventName = req.headers['x-canvas-event-name'] || req.body?.event_name || '';
      const eventHash = crypto.createHash('sha256')
        .update(JSON.stringify({ ...req.body, eventId, eventName }))
        .digest('hex');

      if (!eventName) {
        return this._jsonError(res, 400, `Evento webhook sin nombre y cuerpo sin event_name`);
      }

      // Registro atómico para bloquear condiciones de carrera
      const isNewEvent = await this._registrarEventoAtómico(eventHash, eventName);
      if (!isNewEvent) {
        return res.status(202).json({ exito: true, mensaje: 'Evento ya procesado (idempotente)' });
      }

      if (eventName === 'grade_change' || eventName === 'submission_updated') {
        const payload = req.body;

        const courseId = payload.course_id || (payload.data && payload.data.course_id);
        const assignmentId = payload.assignment_id || (payload.data && payload.data.assignment_id);
        const studentId = payload.user_id || (payload.data && payload.data.user_id);
        const rawGrade = payload.score ?? payload.grade ?? (payload.data && payload.data.score);
        // null/''/undefined => indefinido; 0 es una nota válida. Convertir a número.
        const grade = (rawGrade === '' || rawGrade === null) ? undefined : Number(rawGrade);

        if (!courseId || !assignmentId || !studentId || grade === undefined || Number.isNaN(grade)) {
          return this._jsonError(res, 400, `Campos requeridos faltantes en event_name=${eventName}: courseId=${courseId}, assignmentId=${assignmentId}, studentId=${studentId}, grade=${grade}`);
        }

        logger.info(`[Webhook] Detectado cambio de nota para estudiante ${studentId} en curso ${courseId}, tarea ${assignmentId}. Nota: ${grade}`);

        const defaultTemplateId = 1;

        this.feedbackService.generateFeedback(courseId, assignmentId, studentId, defaultTemplateId, grade)
          .then(() => {
            logger.info(`[Webhook] Generación automática exitosa (RF41) para ${studentId}`);
          })
          .catch(async err => {
            logger.error(`[Webhook] Error en generación automática (RF41):`, { error: err.message });
            // Revertir el estado de procesado para permitir reintentos
            await db.query('DELETE FROM webhook_events WHERE event_hash = $1', [eventHash]).catch(() => {});
          });

        return res.status(202).json({ exito: true, mensaje: 'Evento recibido y procesado en background (RF41)' });
      }

      res.status(200).json({ exito: true, mensaje: 'Evento ignorado' });
    } catch (error) {
      logger.error('[Webhook] Error procesando evento:', { error: error.message, stack: error.stack });
      return this._jsonError(res, 500, 'Error interno procesando el webhook. Consulte los logs del servidor.');
    }
  }
}
