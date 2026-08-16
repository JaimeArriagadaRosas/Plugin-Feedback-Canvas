import db from '../data/db.js';
import logger from '../utils/logger.js';

const NEW_TEMPLATES = [
  {
    nombre: 'Standard Class',
    contenido: JSON.stringify({
      alto: 'Act as a highly motivating teacher and write a congratulatory message for student {{nombre_estudiante}}.\nCongratulate them on their excellent performance, explicitly mentioning they obtained {{calificacion}}.\nEncourage them to maintain their level, indicating how their performance positively contributes to the {{promedio_curso}}.\nMaintain a warm, professional tone directly addressed to the student.',
      medio: 'Act as a constructive teacher and write a feedback message for student {{nombre_estudiante}}.\nMention that they have achieved {{calificacion}}.\nTell them they have done a good job, but there are key areas they need to review to improve their understanding of the material.\nUse the {{promedio_curso}} as a reference to motivate them to improve.\nMaintain an encouraging, empathetic, and professional tone.',
      bajo: 'Act as a supportive teacher and write a guiding message for student {{nombre_estudiante}}, who has failed to pass, obtaining {{calificacion}}.\nThe message should not be punitive, but focused on offering academic support. Invite the student to review the course materials, attend tutoring hours and not get discouraged.\nMention the {{promedio_curso}} only if it helps to demonstrate that it is a difficult topic where many need help.\nMaintain a very empathetic, understanding, and motivating tone.'
    })
  },
  {
    nombre: 'Detailed Feedback',
    contenido: JSON.stringify({
      alto: 'Act as a rigorous evaluator. Address {{nombre_estudiante}} and detail the strong points that led them to obtain {{calificacion}}.\nMention that their performance raises the {{promedio_curso}}. Provide clear instructions on how they can further deepen their knowledge in the subject.',
      medio: 'Act as a detailed evaluator. Address {{nombre_estudiante}} indicating they have reached {{calificacion}}.\nExplain that their performance is in line with the {{promedio_curso}}, but requires more precision in future submissions to master the topic.',
      bajo: 'Act as a meticulous and supportive evaluator. Address {{nombre_estudiante}} regarding their evaluation with {{calificacion}}.\nBreak down the fundamental concepts they urgently need to review. Use the {{promedio_curso}} to contextualize the expected level in the class.'
    })
  },
  {
    nombre: 'Short Evaluation',
    contenido: JSON.stringify({
      alto: 'Briefly congratulate {{nombre_estudiante}} for getting {{calificacion}}, exceeding the {{promedio_curso}}. Keep it up!',
      medio: 'Write a brief message for {{nombre_estudiante}} about their performance ({{calificacion}}). Encourage them to raise their level compared to the {{promedio_curso}}.',
      bajo: 'Write a short note of support to {{nombre_estudiante}}, who obtained {{calificacion}}. The {{promedio_curso}} indicates it is a complex topic, offer them help.'
    })
  }
];

export async function runReseed() {
  logger.info('[RESEED] Starting template re-seed process (Hard-Delete)...');

  try {
    // 1. Clear foreign keys in configuracion_asignacion
    logger.info('[RESEED] Unlinking templates from assignment configurations...');
    await db.query('UPDATE configuracion_asignacion SET plantilla_id = NULL');

    // 2. Clear foreign keys in Historial_Feedback_Generado (optional if test db)
    logger.info('[RESEED] Unlinking templates from feedback history...');
    await db.query('UPDATE Historial_Feedback_Generado SET plantilla_id = NULL');

    // 3. Delete all existing templates
    logger.info('[RESEED] Deleting all old templates...');
    await db.query('DELETE FROM Plantilla_Feedback');

    // 4. Insert new base templates (profesor_id IS NULL)
    logger.info('[RESEED] Inserting new base templates...');
    for (const template of NEW_TEMPLATES) {
      await db.query(
        'INSERT INTO Plantilla_Feedback (nombre, contenido) VALUES ($1, $2)',
        [template.nombre, template.contenido]
      );
    }

    logger.info('[RESEED] Process completed successfully! New templates have been installed.');
  } catch (error) {
    logger.error('[RESEED] ERROR during re-seed:', { error: error.message });
  } finally {
    process.exit(0);
  }
}

// Execute if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runReseed();
}
