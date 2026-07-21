import db from '../../data/db.js';
import logger from '../../utils/logger.js';

const DEFAULT_TEMPLATES = [
  {
    nombre: 'Plantilla Retroalimentación - Rango Bajo (0-3.9)',
    contenido: 'Estimado/a {{STUDENT_NAME}},\n\nTu calificación en {{ASSIGNMENT_NAME}} es {{CHILE_GRADE}} de 7.0 ({{CANVAS_SCORE}} de {{POINTS_POSSIBLE}} puntos en Canvas).\n\n{{TONE_INSTRUCTION}}.\n\nResultados del examen:\n{{QUESTIONS_DETAIL}}\n\nRevisa especialmente los temas donde tuviste dificultades y no dudes en consultar en la próxima clase.\n\nSaludos cordiales,\nProfesor'
  },
  {
    nombre: 'Plantilla Retroalimentación - Rango Medio (4.0-5.9)',
    contenido: 'Estimado/a {{STUDENT_NAME}},\n\nTu calificación en {{ASSIGNMENT_NAME}} es {{CHILE_GRADE}} de 7.0 ({{CANVAS_SCORE}} de {{POINTS_POSSIBLE}} puntos en Canvas).\n\n{{TONE_INSTRUCTION}}.\n\nResultados del examen:\n{{QUESTIONS_DETAIL}}\n\nBuen trabajo, pero hay aspectos que puedes mejorar. Sigue esforzándote.\n\nSaludos cordiales,\nProfesor'
  },
  {
    nombre: 'Plantilla Retroalimentación - Rango Alto (6.0-7.0)',
    contenido: 'Estimado/a {{STUDENT_NAME}},\n\nTu calificación en {{ASSIGNMENT_NAME}} es {{CHILE_GRADE}} de 7.0 ({{CANVAS_SCORE}} de {{POINTS_POSSIBLE}} puntos en Canvas).\n\n{{TONE_INSTRUCTION}}.\n\nResultados del examen:\n{{QUESTIONS_DETAIL}}\n\nExcelente trabajo. Dominas los conceptos clave. ¡Felicitaciones!\n\nSaludos cordiales,\nProfesor'
  }
];

export async function seedLocalTemplates() {
  try {
    const res = await db.query('SELECT id FROM Plantilla_Feedback');
    const count = res.rows.length;
    if (count >= 3) {
      logger.info(`[SEED] Ya existen ${count} plantillas. Seed omitido.`);
      return;
    }
    for (const template of DEFAULT_TEMPLATES) {
      await db.query(
        'INSERT INTO Plantilla_Feedback (nombre, contenido) VALUES ($1, $2) RETURNING id',
        [template.nombre, template.contenido]
      );
    }
    logger.info('[SEED] Seed de plantillas completado.');
  } catch (error) {
    logger.error('[SEED] ERROR en seed de plantillas:', { error: error.message });
  }
}
