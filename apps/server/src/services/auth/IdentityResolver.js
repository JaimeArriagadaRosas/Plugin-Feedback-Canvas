import db from '../../data/db.js';
import logger from '../../utils/logger.js';

class IdentityResolver {
  constructor() {
    this.cache = new Map();
  }

  async resolveNumericId(canvasSub) {
    if (!canvasSub) return null;

    logger.info(`[IDENTITY] Resolviendo UUID de canvas_sub a canvas_user_id numérico: ${canvasSub}`);

    // 1. Check cache
    if (this.cache.has(canvasSub)) {
      const cachedId = this.cache.get(canvasSub);
      logger.info(`[IDENTITY] Resolución de caché exitosa: ${canvasSub} -> ${cachedId}`);
      return cachedId;
    }

    // 2. Query canvas_user_tokens table
    try {
      logger.info(`[IDENTITY] Consultando tabla usuarios_local para ${canvasSub}...`);
      const res = await db.query(
        'SELECT canvas_user_id FROM usuarios_local WHERE canvas_user_uuid = $1',
        [canvasSub]
      );

      if (res.rowCount > 0 && res.rows[0].canvas_user_id) {
        const numericId = String(res.rows[0].canvas_user_id);
        logger.info(`[IDENTITY] Resolución exitosa en DB: ${canvasSub} -> ${numericId}`);
        this.cache.set(canvasSub, numericId);
        if (this.cache.size > 1000) {
          const oldestKey = this.cache.keys().next().value;
          this.cache.delete(oldestKey);
        }
        return numericId;
      } else {
        logger.warn(`[IDENTITY] No se encontró canvas_user_id en usuarios_local para: ${canvasSub}`);
      }
    } catch (error) {
      logger.error(`[IDENTITY] Error al consultar usuarios_local para ${canvasSub}:`, { error: error.message });
    }

    // Fallback original si falla la resolución
    logger.warn(`[IDENTITY] Fallback: Devolviendo UUID original ${canvasSub} porque no se pudo resolver un ID numérico.`);
    return String(canvasSub);
  }
}

export default new IdentityResolver();
