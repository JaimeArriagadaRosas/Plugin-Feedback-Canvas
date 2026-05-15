import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

let pool;
let isMock = false;

try {
  pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  pool.on('error', (err) => {
    console.error('[DB] Error inesperado:', err.message);
  });
} catch (error) {
  console.warn('[DB] No se pudo inicializar el pool de conexiones. Usando modo MOCK.');
  isMock = true;
}

/**
 * Cliente Mock para desarrollo sin PostgreSQL
 * Simula respuestas de éxito para que el flujo de orquestación funcione.
 */
const mockDb = {
  query: async (text, params) => {
    console.log(`[DB-MOCK] Ejecutando: ${text.substring(0, 100)}...`);
    
    // 1. Simular búsqueda de plantilla
    if (text.includes('SELECT * FROM plantillas')) {
      return { 
        rows: [{ 
          id: params[0], 
          nombre: 'Plantilla de Prueba', 
          contenido: 'Hola {{STUDENT_NAME}}, sobre tu tarea {{ASSIGNMENT_NAME}} (Nota: {{SUBMISSION_SCORE}}): {{TONE_INSTRUCTION}}' 
        }] 
      };
    }

    // 2. Simular búsqueda de historial académico
    if (text.includes('SELECT historial_json')) {
      return {
        rows: [{
          historial_json: [
            { grade: 9.0, date: '2026-05-01' },
            { grade: 8.5, date: '2026-05-05' }
          ]
        }]
      };
    }

    // 3. Simular INSERT en historial_feedback (Retornar el contenido enviado)
    if (text.includes('INSERT INTO historial_feedback')) {
      return {
        rows: [{
          id: Math.floor(Math.random() * 1000),
          curso_id: params[0],
          tarea_id: params[1],
          estudiante_id: params[2],
          plantilla_id: params[3],
          contenido: params[4], // IMPORTANTE: Retornar el feedback generado
          prompt_usado: params[5]
        }]
      };
    }

    // 4. Simular INSERT en historial_academico
    if (text.includes('INSERT INTO historial_academico')) {
      return { rows: [{ id: 1 }] };
    }

    return { rows: [], rowCount: 0 };
  }
};

export default {
  query: (text, params) => isMock ? mockDb.query(text, params) : pool.query(text, params),
  pool: pool,
  isMock: () => isMock
};
