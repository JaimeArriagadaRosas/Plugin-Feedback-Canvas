import logger from '../utils/logger.js';

const nonces = new Map();
const NONCE_TTL_MS = 5 * 60 * 1000;
const CLEANUP_INTERVAL = 10;
let validationCount = 0;

let mutex = Promise.resolve();

async function withLock(fn) {
  const prev = mutex;
  let resolve;
  const p = new Promise(r => resolve = r);
  mutex = p.then(() => resolve());
  try {
    return await fn();
  } finally {
    // prev ya resolvió; mantener la cadena para que nuevas peticiones esperen
  }
}

export function storeNonce(nonce) {
  if (!nonce) return null;
  nonces.set(nonce, {
    createdAt: Date.now(),
    consumed: false
  });
  return nonce;
}

export async function validateAndConsumeNonce(nonce) {
  if (!nonce) return false;
  return withLock(() => {
    validationCount++;
    if (validationCount % CLEANUP_INTERVAL === 0) {
      cleanupExpired();
    }
    const entry = nonces.get(nonce);
    if (!entry || entry.consumed) {
      logger.warn('[LTI-NONCE] Nonce inválido o reutilizado', { nonce: nonce.substring(0, 20) });
      return false;
    }
    entry.consumed = true;
    entry.consumedAt = Date.now();
    logger.info('[LTI-NONCE] Nonce consumido', { nonce: nonce.substring(0, 20), age: Date.now() - entry.createdAt });
    return true;
  });
}

function cleanupExpired() {
  const now = Date.now();
  let removed = 0;
  for (const [nonce, entry] of nonces) {
    if (now - entry.createdAt > NONCE_TTL_MS) {
      nonces.delete(nonce);
      removed++;
    }
  }
  if (removed > 0) {
    logger.debug(`[LTI-NONCE] Limpiados ${removed} nonces expirados`);
  }
}

export function getNonceStats() {
  let consumed = 0;
  let pending = 0;
  for (const entry of nonces.values()) {
    if (entry.consumed) consumed++;
    else pending++;
  }
  return {
    total: nonces.size,
    consumed,
    pending
  };
}
