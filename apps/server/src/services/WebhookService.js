import db from '../data/db.js';
import logger from '../utils/logger.js';

export default class WebhookService {
  async registrarEventoAtómico(eventHash, eventType) {
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

  async moverADeadLetter(eventHash, eventType, payload, lastError, attempts) {
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

  async estaEnDeadLetter(eventHash) {
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
}
