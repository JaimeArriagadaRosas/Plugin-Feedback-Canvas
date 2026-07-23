import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'canvas_user',
  password: process.env.DB_PASSWORD || 'canvas_password',
  database: process.env.DB_NAME || 'feedback_db'
});

import EncryptionService from '../src/services/infrastructure/EncryptionService.js';

async function checkTokens() {
  try {
    const res = await pool.query('SELECT canvas_sub, access_token, actualizado_en FROM canvas_user_tokens');
    console.log(`[AUDIT] Tokens encontrados en la tabla canvas_user_tokens: ${res.rowCount}`);
    res.rows.forEach(row => {
      let dec = 'Error';
      try {
        dec = EncryptionService.decrypt(row.access_token);
      } catch (e) {}
      console.log(`- Usuario (sub): ${row.canvas_sub} | Token (primeros 15 chars): ${dec.substring(0, 15)}... | Última actualización: ${row.actualizado_en}`);
    });
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    pool.end();
  }
}

checkTokens();
