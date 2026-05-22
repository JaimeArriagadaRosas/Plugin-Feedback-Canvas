import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

let pool;
let isMock = process.env.VITE_USE_MOCK_DATA === 'true' || !process.env.DB_HOST;

if (!isMock) {
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
} else {
  console.log('[DB] Inicializando base de datos en modo MOCK.');
}

const mockFeedbacks = [
  { id: 1, estudiante_id: 1, curso_id: 14852, tarea_id: 101, plantilla_id: 1, contenido_generado: "Buen trabajo en la entrega. Presentas una estructura bastante sólida y bien enfocada. Sigue así.", estado: "EDITADO", fecha_generacion: new Date() },
  { id: 2, estudiante_id: 2, curso_id: 14852, tarea_id: 101, plantilla_id: 1, contenido_generado: "Muy buen desarrollo, demuestras un dominio sobresaliente de los conceptos de diseño y análisis.", estado: "PENDIENTE", fecha_generacion: new Date() },
  { id: 3, estudiante_id: 3, curso_id: 14852, tarea_id: 101, plantilla_id: 1, contenido_generado: "Se requiere revisión urgente de los temas de arquitectura de software para nivelar el desempeño.", estado: "RECHAZADO", fecha_generacion: new Date() }
];

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

    // 3. Simular INSERT en historial_feedback
    if (text.includes('INSERT INTO historial_feedback') || text.includes('INSERT INTO historial_feedbacks')) {
      const newFb = {
        id: Math.floor(Math.random() * 1000) + 10,
        estudiante_id: params[0],
        curso_id: params[1],
        tarea_id: params[2],
        plantilla_id: params[3],
        contenido_generado: params[4],
        prompt_usado: params[5],
        estado: 'PENDIENTE',
        fecha_generacion: new Date()
      };
      mockFeedbacks.unshift(newFb);
      return {
        rows: [newFb]
      };
    }

    // 3b. Simular SELECT en historial_feedbacks
    if (text.includes('SELECT') && text.includes('historial_feedbacks')) {
      return {
        rows: mockFeedbacks
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
  query: async (text, params) => {
    if (isMock) return mockDb.query(text, params);
    try {
      return await pool.query(text, params);
    } catch (error) {
      console.warn(`[DB] Error en base de datos real: ${error.message}. Cambiando a MOCK.`);
      isMock = true;
      return mockDb.query(text, params);
    }
  },
  pool: pool,
  isMock: () => isMock
};
