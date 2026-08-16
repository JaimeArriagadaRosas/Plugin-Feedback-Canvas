/**
 * db_health.js
 * Responsibility: Verifies the database connection health in an isolated manner.
 */
import logger from '../utils/logger.js';
import { DatabaseConnectionError } from '../utils/errors.js';

/**
 * Performs a basic ping to the database using the pool.
 * @param {import('pg').Pool} pool 
 * @returns {Promise<boolean>}
 */
export async function pingDatabase(pool) {
  let client = null;
  try {
    client = await pool.connect();
    await client.query('SELECT 1');
    return true;
  } catch (error) {
    logger.debug('[DB-HEALTH] Failed to ping the database:', error.message);
    throw new DatabaseConnectionError('PostgreSQL healthcheck failed', error);
  } finally {
    if (client) {
      client.release();
    }
  }
}
