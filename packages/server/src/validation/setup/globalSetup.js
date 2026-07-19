import { PostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let container;

export async function setup({ provide }) {
  console.log('[GlobalSetup] Iniciando Testcontainer PostgreSQL...');
  container = await new PostgreSqlContainer('postgres:15-alpine').start();
  
  const uri = container.getConnectionUri();
  process.env.DATABASE_URL = uri;

  // Pass to worker threads
  provide('DATABASE_URL', uri);

  // Load schema
  const pool = new pg.Pool({ connectionString: uri });
  const schemaPath = path.resolve(__dirname, '../../data/schema.sql');
  const schema = await fs.readFile(schemaPath, 'utf8');
  await pool.query(schema);
  await pool.end();
  console.log('[GlobalSetup] Base de datos lista.');
}

export async function teardown() {
  if (container) {
    console.log('[GlobalSetup] Deteniendo Testcontainer...');
    await container.stop();
  }
}
