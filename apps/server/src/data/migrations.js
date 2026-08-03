import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import db from '../data/db.js';
import logger from '../utils/logger.js';

dotenv.config({ quiet: true });

const MIGRATIONS_DIR = path.join(process.cwd(), 'db', 'migrations');

async function ensureMigrationsTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      executed_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  
  await db.query(`
    CREATE TABLE IF NOT EXISTS migration_logs (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        version VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL,
        logs TEXT,
        ejecutado_en TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

async function getExecutedMigrations() {
  const res = await db.query('SELECT version FROM schema_migrations ORDER BY version ASC');
  return new Set(res.rows.map(r => r.version));
}

async function runMigrations() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
    return;
  }

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  if (files.length === 0) return;

  const client = await db.pool.connect();
  try {
    // Advisory lock to prevent race conditions during concurrent deployments
    await client.query('SELECT pg_advisory_lock(123456789)');
    
    await ensureMigrationsTable();
    const executed = await getExecutedMigrations();

    for (const file of files) {
      const version = file.replace('.sql', '');
      if (executed.has(version)) continue;

      logger.info(`[MIGRATION] Ejecutando: ${file}`);
      const filePath = path.join(MIGRATIONS_DIR, file);
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      const sql = fs.readFileSync(filePath, 'utf-8');

      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
        await client.query('INSERT INTO migration_logs (version, status, logs) VALUES ($1, $2, $3)', [version, 'SUCCESS', `Ejecución exitosa de ${file}`]);
        await client.query('COMMIT');
        logger.info(`[MIGRATION] OK: ${file}`);
      } catch (error) {
        await client.query('ROLLBACK');
        await client.query('INSERT INTO migration_logs (version, status, logs) VALUES ($1, $2, $3)', [version, 'FAILED', `Error: ${error.message}\n${error.stack}`]).catch(e => { console.debug('Error in migration query fallback', e.message); });
        logger.error(`[MIGRATION] ERROR en ${file}:`, { error: error.message, stack: error.stack });
        throw error;
      }
    }
  } finally {
    // Release the advisory lock
    await client.query('SELECT pg_advisory_unlock(123456789)').catch(e => { console.debug('Error in migration query fallback', e.message); });
    client.release();
  }
}

export { runMigrations };
