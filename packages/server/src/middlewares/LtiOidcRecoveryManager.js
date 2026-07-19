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
        this.mappingCache.set(cacheKey, true);
        return true;
      }
    } catch (err) {
      // Ignorar si no se puede parsear a BigInt
    }

    this.mappingCache.set(cacheKey, false);
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
      throw new AppError(`jwt audience invalid. expected: ${targetClientId} but got: ${receivedAudience.join(',')}`, 401);
    }
    
    logger.info('[LtiOidcRecoveryManager] Audience verificada y saneada con éxito.');
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
      logger.error('[LtiOidcRecoveryManager] [ITP_COOKIE_BLOCK_DETECTED] Posible bloqueo de cookies 3rd-party detectado.', {
        error: error.message,
        ...context
      });
    } else {
      logger.error('[LtiOidcRecoveryManager] OIDC Validation Exception', {
        error: error.message,
        stack: error.stack,
        ...context
      });
    }
  }
}

export default LtiOidcRecoveryManager;
