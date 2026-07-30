import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
import dotenv from 'dotenv';
const { Client } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../');
const SCHEMA_PATH = path.join(ROOT_DIR, 'apps/server/src/data/schema.sql');

export async function runMigrations() {
  dotenv.config({ path: path.join(ROOT_DIR, '.env') });

  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'feedback_db',
  });

  try {
    await client.connect();
    
    if (!fs.existsSync(SCHEMA_PATH)) {
      throw new Error(`Schema file not found at ${SCHEMA_PATH}`);
    }

    const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
    
    // Ejecutar todas las sentencias del esquema
    await client.query(schema);
    
  } finally {
    await client.end();
  }
}
