import db from '../../data/db.js';
import logger from '../../utils/logger.js';

const DEFAULT_TEMPLATES = [
  {
    nombre: 'Clase Estándar',
    contenido: JSON.stringify({
      alto: 'Estimado/a {{STUDENT_NAME}},\n\nTu calificación en {{ASSIGNMENT_NAME}} es {{CHILE_GRADE}} de 7.0 ({{CANVAS_SCORE}} de {{POINTS_POSSIBLE}} puntos en Canvas).\n\n{{TONE_INSTRUCTION}}.\n\nResultados del examen:\n{{QUESTIONS_DETAIL}}\n\nExcelente trabajo. Dominas los conceptos clave. ¡Felicitaciones!\n\nSaludos cordiales,\nProfesor',
      medio: 'Estimado/a {{STUDENT_NAME}},\n\nTu calificación en {{ASSIGNMENT_NAME}} es {{CHILE_GRADE}} de 7.0 ({{CANVAS_SCORE}} de {{POINTS_POSSIBLE}} puntos en Canvas).\n\n{{TONE_INSTRUCTION}}.\n\nResultados del examen:\n{{QUESTIONS_DETAIL}}\n\nBuen trabajo, pero hay aspectos que puedes mejorar. Sigue esforzándote.\n\nSaludos cordiales,\nProfesor',
      bajo: 'Estimado/a {{STUDENT_NAME}},\n\nTu calificación en {{ASSIGNMENT_NAME}} es {{CHILE_GRADE}} de 7.0 ({{CANVAS_SCORE}} de {{POINTS_POSSIBLE}} puntos en Canvas).\n\n{{TONE_INSTRUCTION}}.\n\nResultados del examen:\n{{QUESTIONS_DETAIL}}\n\nRevisa especialmente los temas donde tuviste dificultades y no dudes en consultar en la próxima clase.\n\nSaludos cordiales,\nProfesor'
    })
  },
  {
    nombre: 'Feedback Detallado',
    contenido: JSON.stringify({
      alto: 'Estimado/a {{STUDENT_NAME}},\n\nTu calificación en {{ASSIGNMENT_NAME}} es {{CHILE_GRADE}} de 7.0. Has demostrado un dominio sobresaliente de los conceptos.\n\n{{TONE_INSTRUCTION}}.\n\nDesglose de resultados:\n{{QUESTIONS_DETAIL}}\n\n¡Sigue así, excelente desempeño!\n\nSaludos,\nProfesor',
      medio: 'Estimado/a {{STUDENT_NAME}},\n\nTu calificación en {{ASSIGNMENT_NAME}} es {{CHILE_GRADE}} de 7.0. Tienes una buena base, pero existen áreas específicas que debemos reforzar.\n\n{{TONE_INSTRUCTION}}.\n\nDesglose de resultados:\n{{QUESTIONS_DETAIL}}\n\nTe animo a revisar los puntos señalados.\n\nSaludos,\nProfesor',
      bajo: 'Estimado/a {{STUDENT_NAME}},\n\nTu calificación en {{ASSIGNMENT_NAME}} es {{CHILE_GRADE}} de 7.0. Es fundamental que repasemos el contenido visto en clase.\n\n{{TONE_INSTRUCTION}}.\n\nDesglose de resultados:\n{{QUESTIONS_DETAIL}}\n\nPor favor, contáctame para aclarar dudas.\n\nSaludos,\nProfesor'
    })
  },
  {
    nombre: 'Evaluación Cruzada',
    contenido: JSON.stringify({
      alto: 'Hola {{STUDENT_NAME}},\n\nTu nota es {{CHILE_GRADE}} de 7.0. Tus compañeros y yo coincidimos en que tu trabajo es destacado.\n\n{{TONE_INSTRUCTION}}.\n\nDetalle:\n{{QUESTIONS_DETAIL}}\n\n¡Felicidades!\n\nSaludos,\nProfesor',
      medio: 'Hola {{STUDENT_NAME}},\n\nTu nota es {{CHILE_GRADE}} de 7.0. Según la evaluación cruzada, tu desempeño es promedio, con oportunidades de mejora.\n\n{{TONE_INSTRUCTION}}.\n\nDetalle:\n{{QUESTIONS_DETAIL}}\n\n¡Sigue trabajando!\n\nSaludos,\nProfesor',
      bajo: 'Hola {{STUDENT_NAME}},\n\nTu nota es {{CHILE_GRADE}} de 7.0. La revisión cruzada indica que hay debilidades importantes en tu entrega.\n\n{{TONE_INSTRUCTION}}.\n\nDetalle:\n{{QUESTIONS_DETAIL}}\n\nRevisa el material de apoyo.\n\nSaludos,\nProfesor'
    })
  }
];

// Nombres de plantillas antiguas que deben ser limpiadas
const LEGACY_TEMPLATE_NAMES = [
  'Nueva Plantilla de Feedback',
  'Plantilla Retroalimentación - Rango Alto (6.0-7.0)',
  'Plantilla Retroalimentación - Rango Medio (4.0-5.9)',
  'Plantilla Retroalimentación - Rango Bajo (0-3.9)',
];

const VALID_TEMPLATE_NAMES = DEFAULT_TEMPLATES.map(t => t.nombre);

export async function seedLocalTemplates() {
  try {
    // 1. Obtener todas las plantillas globales existentes (profesor_id IS NULL)
    const res = await db.query('SELECT id, nombre FROM Plantilla_Feedback WHERE profesor_id IS NULL AND deleted_at IS NULL');
    const existing = res.rows;
    const existingNames = new Set(existing.map(t => t.nombre));

    // 2. Eliminar plantillas antiguas/legacy que ya no deben existir (Soft Delete)
    for (const row of existing) {
      if (LEGACY_TEMPLATE_NAMES.includes(row.nombre)) {
        logger.info(`[SEED] Eliminando lógicamente plantilla legacy: "${row.nombre}" (id=${row.id})`);
        await db.query('UPDATE Plantilla_Feedback SET deleted_at = NOW() WHERE id = $1', [row.id]);
      }
    }

    // 3. Insertar solo las plantillas base que faltan (idempotente por nombre)
    let inserted = 0;
    for (const template of DEFAULT_TEMPLATES) {
      if (!existingNames.has(template.nombre)) {
        await db.query(
          'INSERT INTO Plantilla_Feedback (nombre, contenido) VALUES ($1, $2) RETURNING id',
          [template.nombre, template.contenido]
        );
        inserted++;
        logger.info(`[SEED] Plantilla base insertada: "${template.nombre}"`);
      }
    }

    if (inserted === 0) {
      logger.info(`[SEED] Las ${VALID_TEMPLATE_NAMES.length} plantillas base ya existen. Seed omitido.`);
    } else {
      logger.info(`[SEED] Seed de plantillas completado. ${inserted} plantilla(s) insertada(s).`);
    }
  } catch (error) {
    logger.error('[SEED] ERROR en seed de plantillas:', { error: error.message });
  }
}

