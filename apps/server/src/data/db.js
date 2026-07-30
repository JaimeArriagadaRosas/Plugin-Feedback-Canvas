import pg from 'pg';
import dotenv from 'dotenv';
import logger from '../utils/logger.js';
import { handleDbError } from '../security/dbGuard.js';
import { isLocalModeAllowed, isProduction } from '../security/envGuard.js';
import { getEnv } from '../config/index.js';
import { tenantContext } from '../middlewares/TenantMiddleware.js';
import { AppError, DatabaseConnectionError } from '../utils/errors.js';
import { withExponentialBackoff } from './db_retry.js';
import { pingDatabase } from './db_health.js';

dotenv.config({ quiet: true });

const { Pool } = pg;
let pool = null;
let isReconnecting = false;



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
    logger.error('[DB] Error inesperado en el pool:', { error: err.message });
  });
  return newPool;
}

async function reconnectPool() {
  if (isReconnecting) return;
  isReconnecting = true;

  try {
    if (pool) {
      try { await pool.end(); } catch (e) {}
    }

    pool = createPool();

    await withExponentialBackoff(async (attempt) => {
      logger.warn(`[DB] Reintentando conexión a PostgreSQL (intento ${attempt})...`);
      await pingDatabase(pool);
    }, {
      maxAttempts: 5,
      baseDelayMs: 1000,
      maxDelayMs: 15000,
      shouldRetry: isConnectionError,
      onAttemptFailed: (err, attempt, delay) => {
        logger.progress(`[DB-RETRY] Fallo reconexión (intento ${attempt}). Esperando ${delay}ms...`);
      }
    });

    logger.info('[DB] Reconexión a PostgreSQL exitosa.');
  } catch (error) {
    logger.error('[DB] Se agotaron los intentos de reconexión. El pool quedará en null.');
    pool = null;
  } finally {
    isReconnecting = false;
  }
}

async function initializePostgres() {
  logger.info('[DB] Iniciando conexión a PostgreSQL...');
  let autoStarted = false;

  try {
    await withExponentialBackoff(async (attempt) => {
      if (!pool) {
        pool = createPool();
      }

      try {
        await pingDatabase(pool);
      } catch (error) {
        // En entorno local de desarrollo, intentar encender el contenedor en el primer fallo
        if (!isProduction() && attempt === 1 && !autoStarted) {
          let forceRetry = false;
          try {
            const { autoStartLocalDbContainer } = await import('./docker.local.js');
            autoStarted = await autoStartLocalDbContainer();
            if (autoStarted) {
              logger.progress(`[DB] Esperando a que PostgreSQL termine su inicialización...`);
              await new Promise(r => setTimeout(r, 2000));
              forceRetry = true;
            }
          } catch (e) {
            logger.warn('[DB] No se pudo cargar módulo local de docker:', { error: e.message });
          }
          
          if (forceRetry) {
            throw new DatabaseConnectionError('Forcing retry after docker start', error);
          }
        }
        
        if (pool) {
          try { await pool.end(); } catch (e) {}
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
          logger.progress(`[DB] Fallo intento ${attempt}. Esperando ${delay}ms para reintentar...`);
        }
      }
    });

    logger.info('[DB] Conexión inicial a PostgreSQL exitosa.');
  } catch (error) {
    pool = null;
    const details = error.originalError ? error.originalError.message : error.message;
    throw new DatabaseConnectionError(`Fallo crítico: No se pudo conectar a PostgreSQL en el arranque. Detalles: ${details}`, error);
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
