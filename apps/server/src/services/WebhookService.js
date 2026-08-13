import db from '../data/db.js';
import logger from '../utils/logger.js';

export default class WebhookService {
  constructor(database = db) {
    this.db = database;
  }

  async claimEvent(eventHash, eventType, maxAttempts = 5) {
    const result = await this.db.query(
      `INSERT INTO webhook_events
         (event_hash, event_type, attempts, status, processed_at, last_error, updated_at)
       VALUES ($1, $2, 1, 'PROCESSING', NULL, NULL, NOW())
       ON CONFLICT (event_hash) DO UPDATE
       SET attempts = webhook_events.attempts + 1,
           status = 'PROCESSING',
           last_error = NULL,
           updated_at = NOW()
       WHERE webhook_events.status IN ('PENDING', 'FAILED')
         AND webhook_events.attempts < $3
       RETURNING attempts, status`,
      [eventHash, eventType, maxAttempts]
    );

    if (result.rows[0]) {
      return { claimed: true, ...result.rows[0] };
    }

    const existing = await this.db.query(
      'SELECT attempts, status FROM webhook_events WHERE event_hash = $1',
      [eventHash]
    );
    return { claimed: false, ...(existing.rows[0] || { attempts: 0, status: 'UNKNOWN' }) };
  }

  async markProcessed(eventHash) {
    await this.db.query(
      `UPDATE webhook_events
       SET status = 'PROCESSED', processed_at = NOW(), last_error = NULL, updated_at = NOW()
       WHERE event_hash = $1`,
      [eventHash]
    );
  }

  async markFailed(eventHash, error, maxAttempts = 5) {
    const result = await this.db.query(
      `UPDATE webhook_events
       SET status = CASE WHEN attempts >= $2 THEN 'DEAD_LETTER' ELSE 'FAILED' END,
           last_error = $3,
           updated_at = NOW()
       WHERE event_hash = $1
       RETURNING attempts, status`,
      [eventHash, maxAttempts, error]
    );
    const state = result.rows[0] || { attempts: 0, status: 'FAILED' };
    return { ...state, deadLetter: state.status === 'DEAD_LETTER' };
  }

  async moverADeadLetter(eventHash, eventType, payload, lastError, attempts) {
    try {
      await this.db.query(
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
      const result = await this.db.query(
        'SELECT 1 FROM webhook_dead_letter WHERE event_hash = $1 LIMIT 1',
        [eventHash]
      );
      return result.rowCount > 0;
    } catch {
      return false;
    }
  }
}
