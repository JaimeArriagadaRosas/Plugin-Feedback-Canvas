import pg from 'pg';
import dotenv from 'dotenv';
import logger from '../utils/logger.js';
import { handleDbError } from '../security/dbGuard.js';
import { isLocalModeAllowed, isProduction } from '../security/envGuard.js';
import { getEnv } from '../config/index.js';
import { execa } from 'execa';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tenantContext } from '../middlewares/TenantMiddleware.js';

dotenv.config();

const { Pool } = pg;
let pool = null;
let isReconnecting = false;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY_MS = 1000;

function isLocalMode() {
  return isLocalModeAllowed() || (!process.env.DB_HOST && !isProduction());
}

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
  if (connectionString) {
    return new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    });
  }
  return new Pool({
    host: getEnv('DB_HOST'),
    user: getEnv('DB_USER'),
    password: getEnv('DB_PASSWORD'),
    database: getEnv('DB_NAME'),
    port: getEnv('DB_PORT'),
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
  });
}

async function reconnectPool(attempt = 1) {
  if (isLocalMode()) return;
  if (isReconnecting) return;
  isReconnecting = true;

  try {
    if (pool) {
      try {
        await pool.end();
      } catch (e) {
        logger.warn('[DB] Error cerrando pool anterior durante reconexión:', { error: e.message });
      }
    }

    const delay = Math.min(RECONNECT_BASE_DELAY_MS * Math.pow(2, attempt - 1), 30000);
    logger.warn(`[DB] Reintentando conexión a PostgreSQL (intento ${attempt}/${MAX_RECONNECT_ATTEMPTS}) en ${delay}ms...`);
    await new Promise(r => setTimeout(r, delay));

    pool = createPool();
    pool.on('error', (err) => {
      logger.error('[DB] Error inesperado en el pool:', { error: err.message });
    });

    const testClient = await pool.connect();
    try {
      await testClient.query('SELECT 1');
    } finally {
      testClient.release();
    }

    logger.info('[DB] Reconexión a PostgreSQL exitosa.');
  } catch (error) {
    logger.error(`[DB] Fallo en reconexión (intento ${attempt}):`, { error: error.message });
    if (attempt < MAX_RECONNECT_ATTEMPTS) {
      return reconnectPool(attempt + 1);
    }
    logger.error('[DB] Se agotaron los intentos de reconexión. El pool quedará en null.');
    pool = null;
  } finally {
    isReconnecting = false;
  }
}

import { localDb } from './dbLocal.js';

async function autoStartLocalDbContainer() {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const projectRoot = path.resolve(path.dirname(__filename), '../../../../');
    const composeFile = path.join(projectRoot, 'docker-compose.db.yml');
    
    if (fs.existsSync(composeFile)) {
      logger.info('[DB] Base de datos no encontrada. Encendiendo contenedor de PostgreSQL (Docker)...');
      await execa('docker', ['compose', '-f', 'docker-compose.db.yml', 'up', '-d', '--wait'], { cwd: projectRoot });
      logger.info('[DB] Contenedor iniciado y PostgreSQL está listo (healthy).');
      return true;
    }
  } catch (err) {
    logger.warn('[DB] No se pudo iniciar el contenedor de BD automáticamente:', { error: err.message });
  }
  return false;
}

async function initializePostgres() {
  logger.info('[DB] Iniciando conexión a PostgreSQL...');
  let attempt = 1;
  const maxAttempts = 10;
  const baseDelay = 1500;
  let autoStarted = false;

  while (attempt <= maxAttempts) {
    try {
      logger.info(`[DB] Intento de conexión inicial (intento ${attempt}/${maxAttempts})...`);
      pool = createPool();
      pool.on('error', (err) => {
        logger.error('[DB] Error inesperado en el pool:', { error: err.message });
      });
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      logger.info('[DB] Conexión inicial a PostgreSQL exitosa.');
      return;
    } catch (error) {
      if (attempt > 2 || (!autoStarted && isProduction())) {
        logger.warn(`[DB] Falló intento de conexión inicial ${attempt}: ${error.message}`);
      }
      if (pool) {
        try { await pool.end(); } catch (e) {}
      }

      if (!isProduction() && attempt === 1 && !autoStarted) {
        autoStarted = await autoStartLocalDbContainer();
        if (autoStarted) {
          continue; // Reintentar inmediatamente sin incrementar intento si acabamos de iniciar Docker
        }
      }

      if (attempt === maxAttempts) {
        logger.error('[DB] Se agotaron los intentos de conexión inicial. La aplicación podría fallar.');
        pool = null;
        return;
      }
      const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), 15000);
      if (attempt > 2) {
        logger.info(`[DB] Esperando ${delay}ms antes del próximo intento...`);
      }
      await new Promise(r => setTimeout(r, delay));
      attempt++;
    }
  }
}

if (!isLocalMode()) {
  await initializePostgres();
} else {
  logger.info('[DB] Inicializando base de datos en modo LOCAL.');
}

const dbInstance = {
  query: async (text, params) => {
    if (isLocalMode()) return localDb.query(text, params);
    
    const tenantId = tenantContext.getStore();
    if (tenantId) {
      // Si hay un tenant en contexto, ejecutamos la query dentro de una transacción con RLS
      return await dbInstance.executeTransaction(async (client) => {
        return await client.query(text, params);
      }, tenantId);
    }
    
    try {
      if (!pool) {
        await reconnectPool();
      }
      if (!pool) {
        throw new Error('Pool de PostgreSQL no disponible.');
      }
      return await pool.query(text, params);
    } catch (error) {
      if (isConnectionError(error) && !isReconnecting) {
        logger.warn('[DB] Error de conexión detectado. Iniciando reconexión...', { error: error.message });
        await reconnectPool();
      }
      handleDbError(error, 'query');
      throw error;
    }
  },
  get pool() {
    return pool;
  },
  isLocalMode: () => isLocalMode(),
  executeTransaction: async (callback, tenantId = null) => {
    if (isLocalMode()) {
      const mockClient = { query: (text, params) => localDb.query(text, params) };
      return await callback(mockClient);
    }
    
    let client;
    try {
      if (!pool) {
        await reconnectPool();
      }
      if (!pool) {
        throw new Error('Pool de PostgreSQL no disponible para transacción.');
      }
      client = await pool.connect();
    } catch (e) {
      if (isConnectionError(e) && !isReconnecting) {
        await reconnectPool();
        if (pool) {
          client = await pool.connect();
        } else {
          throw new Error('Pool de PostgreSQL no disponible para transacción tras reconexión.');
        }
      } else {
        handleDbError(e, 'transaction-connect');
        throw e;
      }
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
      throw e;
    } finally {
      if (client) client.release();
    }
  },
  withTenant: async (tenantId, callback) => {
    return await dbInstance.executeTransaction(callback, tenantId);
  }
};

export default dbInstance;
