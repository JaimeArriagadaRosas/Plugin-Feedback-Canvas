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
  { id: 1, estudiante_id: 1, curso_id: 14852, tarea_id: 101, plantilla_id: 1, contenido_generado: "Buen trabajo en la entrega. Presentas una estructura bastante sólida y bien enfocada. Sigue así.", estado: "EDITADO", calificacion_profesor: 4, calificacion_estudiante: null, fecha_generacion: new Date() },
  { id: 2, estudiante_id: 2, curso_id: 14852, tarea_id: 101, plantilla_id: 1, contenido_generado: "Muy buen desarrollo, demuestras un dominio sobresaliente de los conceptos de diseño y análisis.", estado: "APROBADO", calificacion_profesor: 5, calificacion_estudiante: null, fecha_generacion: new Date() },
  { id: 3, estudiante_id: 3, curso_id: 14852, tarea_id: 101, plantilla_id: 1, contenido_generado: "Se requiere revisión urgente de los temas de arquitectura de software para nivelar el desempeño.", estado: "RECHAZADO", calificacion_profesor: null, calificacion_estudiante: null, fecha_generacion: new Date() }
];

/**
 * Cliente Mock para desarrollo sin PostgreSQL
 * Simula respuestas de éxito para que el flujo de orquestación funcione.
 */
const mockDb = {
  query: async (text, params) => {
    console.log(`[DB-MOCK] Ejecutando: ${text.substring(0, 100)}...`);
    
    // 1. Simular búsqueda de plantilla
    if (text.includes('SELECT * FROM Plantilla_Feedback')) {
      return {
        rows: [{
          id: params[0],
          nombre: 'Plantilla de Retroalimentación Estándar',
          contenido: 'Estimado/a {{STUDENT_NAME}},\n\nTu calificación en {{ASSIGNMENT_NAME}} es {{CHILE_GRADE}} de 7.0 ({{CANVAS_SCORE}} de {{POINTS_POSSIBLE}} puntos en Canvas).\n\n{{TONE_INSTRUCTION}}.\n\nResultados del examen:\n{{QUESTIONS_DETAIL}}\n\nRevisa especialmente los temas donde tuviste dificultades y no dudes en consultar en la próxima clase.\n\nSaludos cordiales,\nProfesor'
        }]
      };
    }

    // 2. Simular búsqueda de historial académico (por estudiante)
    if (text.includes('SELECT historial_json')) {
      const studentId = params && params[0]
        ? parseInt(params[0])
        : (text.match(/WHERE estudiante_id\s*=\s*(\d+)/i) || [0, 1])[1];
      const historyMap = {
        1: [{ grade: 9.0, date: '2026-05-01' }, { grade: 8.5, date: '2026-05-05' }, { grade: 9.5, date: '2026-05-15' }],
        2: [{ grade: 5.0, date: '2026-05-01' }, { grade: 6.0, date: '2026-05-05' }, { grade: 5.5, date: '2026-05-15' }],
        3: [{ grade: 3.5, date: '2026-05-01' }, { grade: 4.0, date: '2026-05-05' }, { grade: 3.8, date: '2026-05-15' }],
        4: [{ grade: 8.0, date: '2026-05-01' }, { grade: 8.5, date: '2026-05-05' }, { grade: 8.8, date: '2026-05-15' }],
      };
      return {
        rows: [{ historial_json: historyMap[studentId] || [{ grade: 5.0, date: '2026-05-01' }] }]
      };
    }

    // 3. Simular INSERT en historial_feedback
    if (text.includes('INSERT INTO historial_feedback') || text.includes('INSERT INTO Historial_Feedback_Generado')) {
      const newFb = {
        id: Math.floor(Math.random() * 1000) + 10,
        estudiante_id: params[0],
        curso_id: params[1],
        tarea_id: params[2],
        plantilla_id: params[3],
        contenido_generado: params[4],
        prompt_usado: params[5],
        estado: 'PENDIENTE',
        fecha_generacion: new Date(),
        nota_canvas: params[6] || null,
        nota_chile: params[7] || null,
        aprobado: params[8] !== undefined ? params[8] : null
      };
      mockFeedbacks.unshift(newFb);
      return {
        rows: [newFb]
      };
    }

    // 3b. Simular SELECT en Historial_Feedback_Generado
    if (text.includes('SELECT') && text.includes('Historial_Feedback_Generado')) {
      return {
        rows: mockFeedbacks
      };
    }

    // 3c. Simular UPDATE en Historial_Feedback_Generado (ratings)
    if (text.includes('UPDATE Historial_Feedback_Generado') && text.includes('calificacion_profesor')) {
       const fb = mockFeedbacks.find(f => f.id == params[1]);
       if (fb) fb.calificacion_profesor = params[0];
       return { rows: [fb] };
    }
    
    if (text.includes('UPDATE Historial_Feedback_Generado') && text.includes('calificacion_estudiante')) {
       const fb = mockFeedbacks.find(f => f.id == params[1]);
       if (fb) fb.calificacion_estudiante = params[0];
       return { rows: [fb] };
    }

    // 4. Simular INSERT en Historial_Academico_Local
    if (text.includes('INSERT INTO Historial_Academico_Local')) {
      return { rows: [{ id: 1 }] };
    }

    // 6. Simular configuracion_asignacion
    if (text.includes('INSERT INTO configuracion_asignacion') || text.includes('UPDATE configuracion_asignacion')) {
      return { rows: [{ id_configuracion: 1, canvas_course_id: params[0], canvas_assignment_id: params[1], feedback_activo: params[2], plantilla_id: params[3] }] };
    }
    
    if (text.includes('SELECT * FROM configuracion_asignacion')) {
      return { rows: [{ id_configuracion: 1, canvas_course_id: params[0], canvas_assignment_id: params[1], feedback_activo: true, plantilla_id: 1 }] };
    }

    if (text.includes('DELETE FROM variables_asignacion') || text.includes('INSERT INTO variables_asignacion')) {
      return { rows: [] };
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
      const errorMsg = error.errors ? error.errors.map(e => e.message).join(', ') : error.message;
      console.warn(`[DB] Error en base de datos real: ${errorMsg}. Cambiando a MOCK.`);
      isMock = true;
      return mockDb.query(text, params);
    }
  },
  pool: pool,
  isMock: () => isMock
};
