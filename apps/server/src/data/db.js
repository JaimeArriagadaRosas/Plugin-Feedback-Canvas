import pg from 'pg';
import dotenv from 'dotenv';
import logger from '../utils/logger.js';
import { handleDbError } from '../security/dbGuard.js';
import { isProduction } from '../security/envGuard.js';
import { getEnv } from '../config/index.js';
import { tenantContext } from '../middlewares/TenantMiddleware.js';
import { DatabaseConnectionError } from '../utils/errors.js';
import { withExponentialBackoff } from './db_retry.js';
import { pingDatabase } from './db_health.js';

dotenv.config({ quiet: true });

const { Pool } = pg;
let pool = null;




function isConnectionError(err) {
  if (!err) return false;
  const code = err.code || '';
  const message = (err.message || '').toLowerCase();
  return (
    code === 'ECONNREFUSED' ||
    code === 'ETIMEDOUT' ||
    code === 'ENOTFOUND' ||
    code === 'SERVICE_NOT_AVAILABLE' ||
    code === 'ADMIN_SHUTDOWN' ||
    message.includes('connection terminated') ||
    message.includes('connection ended') ||
    message.includes('terminating connection') ||
    message.includes('pool is closed') ||
    message.includes('client is closed')
  );
}

function createPool() {
  const connectionString = getEnv('DATABASE_URL') || process.env.DATABASE_URL;
  const poolConfig = connectionString ? {
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
  } : {
    host: getEnv('DB_HOST'),
    user: getEnv('DB_USER'),
    password: getEnv('DB_PASSWORD'),
    database: getEnv('DB_NAME'),
    port: getEnv('DB_PORT'),
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
  };

  const newPool = new Pool(poolConfig);
  newPool.on('error', (err) => {
    logger.error('[DB] Unexpected error in the pool:', { error: err.message });
  });
  return newPool;
}


async function initializePostgres() {
  logger.info('[DB] Starting PostgreSQL connection...');
  let autoStarted = false;

  try {
    await withExponentialBackoff(async (attempt) => {
      if (!pool) {
        pool = createPool();
      }

      try {
        await pingDatabase(pool);
      } catch (error) {
        // In local development environment, try to start the container on the first failure
        if (!isProduction() && attempt === 1 && !autoStarted) {
          let forceRetry = false;
          try {
            const { autoStartLocalDbContainer } = await import('./docker.local.js');
            autoStarted = await autoStartLocalDbContainer();
            if (autoStarted) {
              logger.progress(`[DB] Waiting for PostgreSQL to finish initialization...`);
              await new Promise(r => setTimeout(r, 2000));
              forceRetry = true;
            }
          } catch (e) {
            logger.warn('[DB] Could not load local docker module:', { error: e.message });
          }
          
          if (forceRetry) {
            throw new DatabaseConnectionError('Forcing retry after docker start', error);
          }
        }
        
        if (pool) {
          try { await pool.end(); } catch (e) { logger.debug('Error closing pool', { error: e.message }); }
          pool = null;
        }
        throw error;
      }
    }, {
      maxAttempts: 10,
      baseDelayMs: 1500,
      maxDelayMs: 15000,
      shouldRetry: (err) => isConnectionError(err.originalError || err) || err.message.includes('Forcing retry'),
      onAttemptFailed: (err, attempt, delay) => {
        if (!err.message.includes('Forcing retry')) {
          logger.progress(`[DB] Attempt ${attempt} failed. Waiting ${delay}ms to retry...`);
        }
      }
    });

    logger.info('[DB] Initial PostgreSQL connection successful.');

    // Apply RLS fix automatically
    try {
      if (pool) {
        await pool.query(`
          DROP POLICY IF EXISTS aislar_tenant_feedback ON Historial_Feedback_Generado;
          CREATE POLICY aislar_tenant_feedback ON Historial_Feedback_Generado
          USING (profesor_id = current_setting('app.current_tenant', true) OR estudiante_id = current_setting('app.current_tenant', true));
        `);
        logger.info('[DB] RLS migration for Historial_Feedback_Generado applied successfully.');
      }
    } catch (migErr) {
      logger.error('[DB] Error applying RLS migration:', { error: migErr.message });
    }
    
  } catch (error) {
    pool = null;
    const details = error.originalError ? error.originalError.message : error.message;
    throw new DatabaseConnectionError(`Critical failure: Could not connect to PostgreSQL on startup. Details: ${details}`, error);
  }
}

await initializePostgres();

const dbInstance = {
  query: async (text, params) => {
    
    const tenantId = tenantContext.getStore();
    if (tenantId) {
      return await dbInstance.executeTransaction(async (client) => {
        return await client.query(text, params);
      }, tenantId);
    }
    
    return await withExponentialBackoff(async (attempt) => {
      if (!pool) {
        pool = createPool();
      }
      try {
        return await pool.query(text, params);
      } catch (error) {
        handleDbError(error, 'query');
        throw error;
      }
    }, {
      maxAttempts: 3,
      baseDelayMs: 500,
      maxDelayMs: 2000,
      shouldRetry: isConnectionError,
    });
  },
  get pool() {
    return pool;
  },
  executeTransaction: async (callback, tenantId = null) => {
    let client;
    return await withExponentialBackoff(async (attempt) => {
      try {
        if (!pool) {
          pool = createPool();
        }
        client = await pool.connect();
      } catch (e) {
        handleDbError(e, 'transaction-connect');
        throw e;
      }

      try {
        await client.query('BEGIN');
        if (tenantId) {
          await client.query(`SELECT set_config('app.current_tenant', $1, true)`, [tenantId]);
        }
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
      } catch (e) {
        await client.query('ROLLBACK');
        handleDbError(e, 'transaction-execution');
        // We do not retry transaction execution failures, only connections, unless it's a specific serialization failure.
        throw e;
      } finally {
        if (client) client.release();
      }
    }, {
      maxAttempts: 3,
      baseDelayMs: 500,
      maxDelayMs: 2000,
      shouldRetry: (err) => isConnectionError(err) && !client, // only retry on connect, not within transaction
    });
  },
  withTenant: async (tenantId, callback) => {
    return await dbInstance.executeTransaction(callback, tenantId);
  }
};

export default dbInstance;
