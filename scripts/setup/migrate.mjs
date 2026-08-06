import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
import dotenv from 'dotenv';
const { Client } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../');
const MIGRATIONS_DIR = path.join(ROOT_DIR, 'db', 'migrations');

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      executed_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  
  await client.query(`
    CREATE TABLE IF NOT EXISTS migration_logs (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        version VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL,
        logs TEXT,
        ejecutado_en TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

async function getExecutedMigrations(client) {
  const res = await client.query('SELECT version FROM schema_migrations ORDER BY version ASC');
  return new Set(res.rows.map(r => r.version));
}

export async function runMigrations() {
  dotenv.config({ path: path.join(ROOT_DIR, '.env') });

  // Utilizar DATABASE_URL si está disponible, o construir desde variables
  const connectionConfig = process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_NAME || 'feedback_db',
      };

  const client = new Client(connectionConfig);

  try {
    await client.connect();
    console.log('[MIGRATION] Conexión a base de datos establecida.');

    if (!fs.existsSync(MIGRATIONS_DIR)) {
      fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
      return;
    }

    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b));

    if (files.length === 0) {
      console.log('[MIGRATION] No hay archivos de migración.');
      return;
    }

    // Advisory lock para evitar race conditions
    await client.query('SELECT pg_advisory_lock(123456789)');
    
    await ensureMigrationsTable(client);
    const executed = await getExecutedMigrations(client);

    for (const file of files) {
      const version = file.replace('.sql', '');
      if (executed.has(version)) continue;

      console.log(`[MIGRATION] Ejecutando: ${file}`);
      const filePath = path.join(MIGRATIONS_DIR, file);
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      const sql = fs.readFileSync(filePath, 'utf-8');

      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
        await client.query('INSERT INTO migration_logs (version, status, logs) VALUES ($1, $2, $3)', [version, 'SUCCESS', `Ejecución exitosa de ${file}`]);
        await client.query('COMMIT');
        console.log(`[MIGRATION] OK: ${file}`);
      } catch (error) {
        await client.query('ROLLBACK');
        await client.query('INSERT INTO migration_logs (version, status, logs) VALUES ($1, $2, $3)', [version, 'FAILED', `Error: ${error.message}\n${error.stack}`]).catch(e => { console.debug('Error in migration query fallback', e.message); });
        console.error(`[MIGRATION] ERROR en ${file}:`, { error: error.message, stack: error.stack });
        throw error;
      }
    }
  } catch (err) {
    console.error(`[MIGRATION] Error general: ${err.message}`);
    throw err;
  } finally {
    // Release the advisory lock
    await client.query('SELECT pg_advisory_unlock(123456789)').catch(e => { console.debug('Error in migration query fallback', e.message); });
    await client.end();
  }
}
