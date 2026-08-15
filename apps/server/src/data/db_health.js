/**
 * db_health.js
 * Responsabilidad: Verifica la salud de la conexión a la base de datos de manera aislada.
 */
import logger from '../utils/logger.js';
import { DatabaseConnectionError } from '../utils/errors.js';

/**
 * Realiza un ping básico a la base de datos usando el pool.
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
