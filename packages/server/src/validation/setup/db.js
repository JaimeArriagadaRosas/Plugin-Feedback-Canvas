import db from '../../data/db.js';

export async function truncateAll() {
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
    'webhook_events'
  ];

  for (const table of tables) {
    try {
      await db.query(`TRUNCATE TABLE ${table} CASCADE`);
    } catch (error) {
      console.warn(`[TEST-DB] No se pudo truncar ${table}:`, error.message);
    }
  }
}

export async function seedFeedback(data = {}) {
  const defaults = {
    estudiante_id: 1,
    curso_id: 14852,
    tarea_id: 101,
    plantilla_id: 1,
    contenido_generado: 'Feedback de prueba',
    prompt_usado: 'Prompt de prueba',
    nota_canvas: 90,
    nota_chile: 6.9,
    aprobado: true,
    estado: 'generado'
  };
  const merged = { ...defaults, ...data };

  const res = await db.query(
    `INSERT INTO Historial_Feedback_Generado
      (estudiante_id, curso_id, tarea_id, plantilla_id, contenido_generado, prompt_usado, nota_canvas, nota_chile, aprobado, estado)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [merged.estudiante_id, merged.curso_id, merged.tarea_id, merged.plantilla_id,
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

export { db };
