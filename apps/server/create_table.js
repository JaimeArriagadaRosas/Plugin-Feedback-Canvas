import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import db from './src/data/db.js';

async function run() {
  try {
    console.log('Creando tabla notificaciones_sistema...');
    await db.query(`
      CREATE TABLE IF NOT EXISTS notificaciones_sistema (
          id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          profesor_id VARCHAR(50) NOT NULL,
          tipo_error VARCHAR(50) NOT NULL,
          mensaje_error TEXT,
          detalle TEXT,
          contexto JSONB,
          leido BOOLEAN DEFAULT FALSE,
          resuelto BOOLEAN DEFAULT FALSE,
          fecha TIMESTAMPTZ DEFAULT NOW(),
          creado_en TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    
    await db.query(`CREATE INDEX IF NOT EXISTS idx_notif_sistema_profesor ON notificaciones_sistema(profesor_id);`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_notif_sistema_tipo ON notificaciones_sistema(tipo_error);`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_notif_sistema_leido ON notificaciones_sistema(leido);`);
    
    console.log('Tabla y los índices creados con éxito.');
    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
}

run();
