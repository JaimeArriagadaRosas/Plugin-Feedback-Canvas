import db from '../../data/db.js';
import logger from '../../utils/logger.js';

class IdentityResolver {
  constructor() {
    this.cache = new Map();
  }

  async resolveNumericId(canvasSub) {
    if (!canvasSub) return null;

    logger.info(`[IDENTITY] Resolving UUID from canvas_sub to numeric canvas_user_id: ${canvasSub}`);

    // 1. Check cache
    if (this.cache.has(canvasSub)) {
      const cachedId = this.cache.get(canvasSub);
      logger.info(`[IDENTITY] Successful cache resolution: ${canvasSub} -> ${cachedId}`);
      return cachedId;
    }

    // 2. Query canvas_user_tokens table
    try {
      logger.info(`[IDENTITY] Querying usuarios_local table for ${canvasSub}...`);
      const res = await db.query(
        'SELECT canvas_user_id FROM usuarios_local WHERE canvas_user_uuid = $1',
        [canvasSub]
      );

      if (res.rowCount > 0 && res.rows[0].canvas_user_id) {
        const numericId = String(res.rows[0].canvas_user_id);
        logger.info(`[IDENTITY] Successful DB resolution: ${canvasSub} -> ${numericId}`);
        this.cache.set(canvasSub, numericId);
        if (this.cache.size > 1000) {
          const oldestKey = this.cache.keys().next().value;
          this.cache.delete(oldestKey);
        }
        return numericId;
      } else {
        logger.warn(`[IDENTITY] canvas_user_id not found in usuarios_local for: ${canvasSub}`);
      }
    } catch (error) {
      logger.error(`[IDENTITY] Error querying local_users for ${canvasSub}:`, { error: error.message });
    }

    // Original fallback if resolution fails
    logger.warn(`[IDENTITY] Fallback: Returning original UUID ${canvasSub} because a numeric ID could not be resolved.`);
    return String(canvasSub);
  }
}

export default new IdentityResolver();
