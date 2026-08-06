import logger from '../utils/logger.js';
import { AppError } from '../utils/errors.js';

/**
 * LtiOidcRecoveryManager
 * 
 * Este módulo se encarga de auditar y auto-recuperar anomalías comunes en el flujo LTI 1.3
 * OIDC, como inconsistencias de Audience (ej. Canvas enviando arrays o strings variados),
 * problemas de estado (cookies bloqueadas por ITP), y otros fallos transitorios.
 * 
 * Toda anomalía se exporta centralizadamente mediante el logger del sistema.
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

    logger.info(`[OIDC_RECOVERY_AUDIT] [${type}] Evento de recuperación o fallo auditable registrado`, event);
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
        logger.info(`[LtiOidcRecoveryManager] Detectado Canvas Global ID. Mapeando ${rId} -> ${targetClientId} (Cacheado)`);
        this._setCache(cacheKey, true);
        this.recordTelemetry('AUDIENCE_RECOVERY', { receivedId: rId, expectedClientId: targetClientId });
        return true;
      }
    } catch (err) {
      // Ignorar si no se puede parsear a BigInt
    }

    this._setCache(cacheKey, false);
    return false;
  }

  /**
   * Coerce y valida el Audience del JWT contra el Client ID esperado.
   * Recupera fallos comunes donde Canvas envía URLs o Arrays.
   * 
   * @param {Object} decoded - Token JWT decodificado
   * @param {String} expectedClientId - Client ID esperado
   * @throws {AppError} Si la recuperación es imposible
   */
  static validateAndRecoverAudience(decoded, expectedClientId) {
    if (!decoded || !decoded.aud) {
      logger.warn('[LtiOidcRecoveryManager] Token JWT sin claim "aud". Fallo OIDC.', { expectedClientId });
      this.recordTelemetry('UNRECOVERABLE_ERROR', { reason: 'missing_aud', expectedClientId });
      throw new AppError(`El token LTI no contiene audiencia (aud)`, 401);
    }

    let receivedAudience = Array.isArray(decoded.aud) ? decoded.aud.map(String) : [String(decoded.aud)];
    const targetClientId = String(expectedClientId);
    
    logger.debug('[LtiOidcRecoveryManager] Analizando Audience LTI', { receivedAudience, targetClientId });

    // Helper para verificar Canvas Global IDs (shard_id * 10000000000000 + local_id)
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
    
    logger.debug('[LtiOidcRecoveryManager] Audience verificada y saneada con éxito.');
  }

  /**
   * Analiza un error general capturado durante la validación OIDC
   * e inyecta telemetría detallada al logger central.
   * @param {Error} error - El error capturado
   * @param {Object} context - Datos del request para telemetría
   */
  static traceError(error, context = {}) {
    // Si el error es por cookies (ej. State missing), alertar sobre bloqueo ITP
    const isCookieIssue = error.message.toLowerCase().includes('state') || error.message.toLowerCase().includes('nonce');
    
    if (isCookieIssue) {
      this.recordTelemetry('ITP_COOKIE_BLOCK', { error: error.message, ...context });
      logger.error('[LtiOidcRecoveryManager] [ITP_COOKIE_BLOCK_DETECTED] Posible bloqueo de cookies 3rd-party detectado.', {
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
