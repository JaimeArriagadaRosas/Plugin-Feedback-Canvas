import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import db from '../data/db.js';

dotenv.config();

const MIGRATIONS_DIR = path.join(process.cwd(), 'db', 'migrations');

async function ensureMigrationsTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      executed_at TIMESTAMPTZ DEFAULT NOW()
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

  await ensureMigrationsTable();
  const executed = await getExecutedMigrations();

  for (const file of files) {
    const version = file.replace('.sql', '');
    if (executed.has(version)) continue;

    console.log(`[MIGRATION] Ejecutando: ${file}`);
    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(filePath, 'utf-8');

    try {
      const client = await db.pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
      console.log(`[MIGRATION] OK: ${file}`);
    } catch (error) {
      console.error(`[MIGRATION] ERROR en ${file}:`, error.message);
      throw error;
    }
  }
}

export { runMigrations };
