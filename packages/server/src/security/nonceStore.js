import crypto from 'node:crypto';
import logger from '../utils/logger.js';

const nonces = new Map();
const NONCE_TTL_MS = 5 * 60 * 1000;

export function storeNonce(nonce) {
  if (!nonce) return null;
  const id = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const entry = {
    nonce,
    createdAt: Date.now(),
    consumed: false
  };
  nonces.set(id, entry);
  cleanupExpired();
  return id;
}

export function validateAndConsumeNonce(nonce) {
  if (!nonce) return false;
  cleanupExpired();
  for (const [id, entry] of nonces) {
    if (entry.nonce === nonce && !entry.consumed) {
      entry.consumed = true;
      entry.consumedAt = Date.now();
      logger.info('[LTI-NONCE] Nonce consumido', { id, age: Date.now() - entry.createdAt });
      return true;
    }
  }
  logger.warn('[LTI-NONCE] Nonce inválido o reutilizado', { nonce: nonce.substring(0, 20) });
  return false;
}

function cleanupExpired() {
  const now = Date.now();
  let removed = 0;
  for (const [id, entry] of nonces) {
    if (now - entry.createdAt > NONCE_TTL_MS) {
      nonces.delete(id);
      removed++;
    }
  }
  if (removed > 0) {
    logger.debug(`[LTI-NONCE] Limpiados ${removed} nonces expirados`);
  }
}

export function getNonceStats() {
  return {
    total: nonces.size,
    consumed: Array.from(nonces.values()).filter(e => e.consumed).length,
    pending: Array.from(nonces.values()).filter(e => !e.consumed).length
  };
}
