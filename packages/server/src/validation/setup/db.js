import db from '../../data/db.js';

export async function truncateAll() {
  if (process.env.NODE_ENV !== 'test') {
    console.warn('[TEST-DB] TRUNCATE omitido. NODE_ENV no es test.');
    return;
  }
  
  const dbName = process.env.DB_NAME || '';
  if (!dbName.includes('test')) {
    console.warn(`[TEST-DB] ADVERTENCIA CRÍTICA: TRUNCATE omitido. La base de datos actual (${dbName}) no parece ser una base de datos de pruebas (debe contener 'test' en el nombre).`);
    return;
  }

  const tables = [
    'Historial_Feedback_Generado',
    'Plantilla_Feedback',
    'Configuracion_Curso_Tarea',
    'configuracion_asignacion',
    'variables_asignacion',
    'Llaves_API_IA',
    'Historial_Academico_Local',
    'Logs_Auditoria',
    'Notificaciones_Feedback',
    'Configuracion_IA',
    'webhook_events',
    'webhook_dead_letter',
    'canvas_user_tokens'
  ];

  for (const table of tables) {
    try {
      await db.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
    } catch (error) {
      console.warn(`[TEST-DB] No se pudo truncar ${table}:`, error.message);
    }
  }
}

export async function seedFeedback(data = {}) {
  const defaults = {
    estudiante_id: '00000000-0000-0000-0000-000000000001',
    profesor_id: '00000000-0000-0000-0001-000000000003',
    curso_id: 14852,
    tarea_id: 101,
    plantilla_id: 1,
    contenido_generado: 'Feedback de prueba',
    prompt_usado: 'Prompt de prueba',
    nota_canvas: 90,
    nota_chile: 6.9,
    aprobado: true,
    estado: 'PENDIENTE'
  };
  const merged = { ...defaults, ...data };

  const res = await db.query(
    `INSERT INTO Historial_Feedback_Generado
      (estudiante_id, profesor_id, curso_id, tarea_id, plantilla_id, contenido_generado, prompt_usado, nota_canvas, nota_chile, aprobado, estado)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [merged.estudiante_id, merged.profesor_id, merged.curso_id, merged.tarea_id, merged.plantilla_id,
     merged.contenido_generado, merged.prompt_usado, merged.nota_canvas,
     merged.nota_chile, merged.aprobado, merged.estado]
  );
  return res.rows[0];
}

export async function seedTemplate(data = {}) {
  const defaults = {
    nombre: 'Plantilla de prueba',
    contenido: 'Estimado/a {{STUDENT_NAME}}, tu nota es {{CHILE_GRADE}}.'
  };
  const merged = { ...defaults, ...data };

  const res = await db.query(
    'INSERT INTO Plantilla_Feedback (nombre, contenido) VALUES ($1, $2) RETURNING *',
    [merged.nombre, merged.contenido]
  );
  return res.rows[0];
}

export async function seedAssignmentConfig(data = {}) {
  const defaults = {
    canvas_course_id: '14852',
    canvas_assignment_id: '101',
    feedback_activo: true,
    plantilla_id: 1,
    profesor_id: '00000000-0000-0000-0000-000000000001'
  };
  const merged = { ...defaults, ...data };

  const res = await db.query(
    `INSERT INTO configuracion_asignacion (canvas_course_id, canvas_assignment_id, feedback_activo, plantilla_id, profesor_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [merged.canvas_course_id, merged.canvas_assignment_id, merged.feedback_activo, merged.plantilla_id, merged.profesor_id]
  );
  return res.rows[0];
}

export { db };
