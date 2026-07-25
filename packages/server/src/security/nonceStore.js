import logger from '../utils/logger.js';
import db from '../data/db.js';

const NONCE_TTL_MS = 5 * 60 * 1000;
let validationCount = 0;

export async function storeNonce(nonce) {
  if (!nonce) return null;
  try {
    await db.query('INSERT INTO lti_nonces (nonce) VALUES ($1) ON CONFLICT DO NOTHING', [nonce]);
  } catch (error) {
    logger.error('[LTI-NONCE] Error guardando nonce', { error: error.message });
  }
  return nonce;
}

export async function validateAndConsumeNonce(nonce) {
  if (!nonce) return false;
  try {
    validationCount++;
    if (validationCount % 10 === 0) {
      cleanupExpired();
    }
    const res = await db.query('DELETE FROM lti_nonces WHERE nonce = $1 RETURNING nonce', [nonce]);
    if (res.rowCount > 0) {
      logger.info('[LTI-NONCE] Nonce consumido', { nonce: nonce.substring(0, 20) });
      return true;
    } else {
      logger.warn('[LTI-NONCE] Nonce inválido o reutilizado', { nonce: nonce.substring(0, 20) });
      return false;
    }
  } catch (error) {
    logger.error('[LTI-NONCE] Error validando nonce', { error: error.message });
    return false;
  }
}

async function cleanupExpired() {
  try {
    const res = await db.query(`DELETE FROM lti_nonces WHERE creado_en < NOW() - INTERVAL '5 minutes'`);
    if (res.rowCount > 0) {
      logger.debug(`[LTI-NONCE] Limpiados ${res.rowCount} nonces expirados`);
    }
  } catch (error) {
    logger.error('[LTI-NONCE] Error limpiando nonces', { error: error.message });
  }
}

export async function getNonceStats() {
  try {
    const res = await db.query('SELECT COUNT(*) FROM lti_nonces');
    return {
      total: parseInt(res.rows[0].count, 10),
      consumed: 0,
      pending: parseInt(res.rows[0].count, 10)
    };
  } catch (error) {
    return { total: 0, consumed: 0, pending: 0 };
  }
}
