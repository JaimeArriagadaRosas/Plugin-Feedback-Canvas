import db from '../data/db.js';
import logger from '../utils/logger.js';

const NEW_TEMPLATES = [
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

export async function runReseed() {
  logger.info('[RESEED] Iniciando proceso de re-seed de plantillas (Hard-Delete)...');

  try {
    // 1. Limpiar llaves foráneas en configuracion_asignacion
    logger.info('[RESEED] Desvinculando plantillas de configuraciones de tareas...');
    await db.query('UPDATE configuracion_asignacion SET plantilla_id = NULL');

    // 2. Limpiar llaves foráneas en Historial_Feedback_Generado (opcional si es db de prueba)
    logger.info('[RESEED] Desvinculando plantillas del historial de feedback...');
    await db.query('UPDATE Historial_Feedback_Generado SET plantilla_id = NULL');

    // 3. Eliminar todas las plantillas existentes
    logger.info('[RESEED] Eliminando todas las plantillas antiguas...');
    await db.query('DELETE FROM Plantilla_Feedback');

    // 4. Insertar las nuevas plantillas base (profesor_id IS NULL)
    logger.info('[RESEED] Insertando nuevas plantillas base...');
    for (const template of NEW_TEMPLATES) {
      await db.query(
        'INSERT INTO Plantilla_Feedback (nombre, contenido) VALUES ($1, $2)',
        [template.nombre, template.contenido]
      );
    }

    logger.info('[RESEED] ¡Proceso completado exitosamente! Las nuevas plantillas han sido instaladas.');
  } catch (error) {
    logger.error('[RESEED] ERROR durante el re-seed:', { error: error.message });
  } finally {
    process.exit(0);
  }
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  runReseed();
}
