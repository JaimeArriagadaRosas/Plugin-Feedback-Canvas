import logger from '../utils/logger.js';
import { AppError } from '../utils/errors.js';

/**
 * LtiOidcRecoveryManager
 * 
 * This module handles auditing and self-recovering common anomalies in the LTI 1.3 flow
 * OIDC, such as Audience inconsistencies (e.g. Canvas sending varied arrays or strings),
 * state problems (cookies blocked by ITP), and other transient failures.
 * 
 * Any anomaly is exported centrally via the system logger.
 */
class LtiOidcRecoveryManager {
  
  static mappingCache = new Map();
  static telemetryMetrics = {
    totalRecoveries: 0,
    itpCookieBlocks: 0,
    audienceRecoveries: 0,
    unrecoverableErrors: 0,
    history: []
  };

  static _setCache(key, value) {
    this.mappingCache.set(key, value);
    if (this.mappingCache.size > 1000) {
      const oldestKey = this.mappingCache.keys().next().value;
      this.mappingCache.delete(oldestKey);
    }
  }

  static recordTelemetry(type, details = {}) {
    const timestamp = new Date().toISOString();
    if (type === 'AUDIENCE_RECOVERY') this.telemetryMetrics.audienceRecoveries++;
    if (type === 'ITP_COOKIE_BLOCK') this.telemetryMetrics.itpCookieBlocks++;
    if (type === 'UNRECOVERABLE_ERROR') this.telemetryMetrics.unrecoverableErrors++;
    this.telemetryMetrics.totalRecoveries++;

    const event = { type, timestamp, ...details };
    this.telemetryMetrics.history.unshift(event);
    if (this.telemetryMetrics.history.length > 100) this.telemetryMetrics.history.pop();

    logger.info(`[OIDC_RECOVERY_AUDIT] [${type}] Auditable recovery or failure event recorded`, event);
  }

  static getTelemetryMetrics() {
    return { ...this.telemetryMetrics };
  }

  static isValidCanvasId(receivedId, expectedClientId) {
    const targetClientId = String(expectedClientId);
    const rId = String(receivedId);
    if (rId === targetClientId) return true;

    const cacheKey = `${rId}-${targetClientId}`;
    if (this.mappingCache.has(cacheKey)) {
      return this.mappingCache.get(cacheKey);
    }

    try {
      const audNum = BigInt(rId);
      const targetNum = BigInt(targetClientId);
      if (audNum >= 10000000000000n && audNum % 10000000000000n === targetNum) {
        logger.info(`[LtiOidcRecoveryManager] Canvas Global ID detected. Mapping ${rId} -> ${targetClientId} (Cached)`);
        this._setCache(cacheKey, true);
        this.recordTelemetry('AUDIENCE_RECOVERY', { receivedId: rId, expectedClientId: targetClientId });
        return true;
      }
    } catch (err) {
      // Ignore if cannot be parsed to BigInt
    }

    this._setCache(cacheKey, false);
    return false;
  }

  /**
   * Coerces and validates the JWT Audience against the expected Client ID.
   * Recovers from common failures where Canvas sends URLs or Arrays.
   * 
   * @param {Object} decoded - Decoded JWT token
   * @param {String} expectedClientId - Expected Client ID
   * @throws {AppError} If recovery is impossible
   */
  static validateAndRecoverAudience(decoded, expectedClientId) {
    if (!decoded || !decoded.aud) {
      logger.warn('[LtiOidcRecoveryManager] JWT token without "aud" claim. OIDC failure.', { expectedClientId });
      this.recordTelemetry('UNRECOVERABLE_ERROR', { reason: 'missing_aud', expectedClientId });
      throw new AppError(`The LTI token does not contain an audience (aud)`, 401);
    }

    let receivedAudience = Array.isArray(decoded.aud) ? decoded.aud.map(String) : [String(decoded.aud)];
    const targetClientId = String(expectedClientId);
    
    logger.debug('[LtiOidcRecoveryManager] Analyzing LTI Audience', { receivedAudience, targetClientId });

    // Helper to verify Canvas Global IDs (shard_id * 10000000000000 + local_id)
    const hasValidAudience = receivedAudience.some(aud => this.isValidCanvasId(aud, targetClientId));

    if (!hasValidAudience) {
      logger.error('[LtiOidcRecoveryManager] Audience Invalid (Unrecoverable).', { 
        received: receivedAudience, 
        expected: targetClientId,
        iss: decoded.iss
      });
      this.recordTelemetry('UNRECOVERABLE_ERROR', { received: receivedAudience, expected: targetClientId });
      throw new AppError(`jwt audience invalid. expected: ${targetClientId} but got: ${receivedAudience.join(',')}`, 401);
    }
    
    logger.debug('[LtiOidcRecoveryManager] Audience successfully verified and sanitized.');
  }

  /**
   * Analyzes a general error caught during OIDC validation
   * and injects detailed telemetry to the central logger.
   * @param {Error} error - The caught error
   * @param {Object} context - Request data for telemetry
   */
  static traceError(error, context = {}) {
    // If the error is due to cookies (e.g. State missing), alert about ITP block
    const isCookieIssue = error.message.toLowerCase().includes('state') || error.message.toLowerCase().includes('nonce');
    
    if (isCookieIssue) {
      this.recordTelemetry('ITP_COOKIE_BLOCK', { error: error.message, ...context });
      logger.error('[LtiOidcRecoveryManager] [ITP_COOKIE_BLOCK_DETECTED] Possible 3rd-party cookies block detected.', {
        error: error.message,
        ...context
      });
    } else {
      this.recordTelemetry('UNRECOVERABLE_ERROR', { error: error.message, ...context });
      logger.error('[LtiOidcRecoveryManager] OIDC Validation Exception', {
        error: error.message,
        stack: error.stack,
        ...context
      });
    }
  }
}

export default LtiOidcRecoveryManager;
