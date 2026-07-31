import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function inspectDB() {
  const pool = new pg.Pool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'feedback_plugin_db',
    port: process.env.DB_PORT || 5432,
  });

  try {
    console.log("=== TABLA: Historial_Feedback_Generado ===");
    const res = await pool.query('SELECT id, estudiante_id, profesor_id, curso_id, estado, fecha_generacion, nombre_estudiante FROM Historial_Feedback_Generado ORDER BY id DESC LIMIT 5');
    console.table(res.rows);

    console.log("=== TABLA: user_lti_mappings ===");
    const mappings = await pool.query('SELECT local_user_id, canvas_sub, canvas_uuid, deployment_id FROM user_lti_mappings ORDER BY id DESC LIMIT 5');
    console.table(mappings.rows);
    
    console.log("=== TABLA: usuarios_local ===");
    const users = await pool.query('SELECT id, rol, canvas_user_id, canvas_user_uuid FROM usuarios_local ORDER BY id DESC LIMIT 5');
    console.table(users.rows);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

inspectDB();
