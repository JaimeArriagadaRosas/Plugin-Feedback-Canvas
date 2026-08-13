import db from '../data/db.js';
import logger from '../utils/logger.js';

const NEW_TEMPLATES = [
  {
    nombre: 'Clase Estándar',
    contenido: JSON.stringify({
      alto: 'Actúa como un profesor muy motivador y redacta un mensaje de felicitación para el estudiante {{nombre_estudiante}}.\nFelicítalo por su excelente desempeño, haciendo mención explícita de que ha obtenido {{calificacion}}.\nAnímalo a mantener su nivel, indicando cómo su rendimiento aporta de forma positiva al {{promedio_curso}}.\nMantén un tono cálido, profesional y directamente dirigido al estudiante.',
      medio: 'Actúa como un profesor constructivo y redacta un mensaje de retroalimentación para el estudiante {{nombre_estudiante}}.\nMenciona que ha logrado {{calificacion}}.\nDile que ha hecho un buen trabajo, pero que existen áreas clave que debe repasar para mejorar su comprensión del material.\nUsa el {{promedio_curso}} como una referencia para motivarlo a superarse.\nMantén un tono alentador, empático y profesional.',
      bajo: 'Actúa como un profesor de apoyo y redacta un mensaje orientador para el estudiante {{nombre_estudiante}}, quien no ha logrado aprobar, obteniendo {{calificacion}}.\nEl mensaje no debe ser punitivo, sino enfocado en ofrecer apoyo académico. Invita al estudiante a revisar los materiales del curso, asistir a las horas de tutoría y no desanimarse.\nMenciona el {{promedio_curso}} solo si sirve para demostrar que es un tema difícil donde muchos necesitan ayuda.\nMantén un tono muy empático, comprensivo y motivador.'
    })
  },
  {
    nombre: 'Feedback Detallado',
    contenido: JSON.stringify({
      alto: 'Actúa como un evaluador riguroso. Dirígete a {{nombre_estudiante}} y detalla los puntos fuertes que le llevaron a obtener {{calificacion}}.\nMenciona que su desempeño eleva el {{promedio_curso}}. Proporciona instrucciones claras de cómo puede seguir profundizando en la materia.',
      medio: 'Actúa como un evaluador detallista. Dirígete a {{nombre_estudiante}} indicando que ha alcanzado {{calificacion}}.\nExplica que su rendimiento se encuentra acorde al {{promedio_curso}}, pero que requiere mayor precisión en sus próximas entregas para dominar el tema.',
      bajo: 'Actúa como un evaluador meticuloso y de apoyo. Dirígete a {{nombre_estudiante}} sobre su evaluación con {{calificacion}}.\nDesglosa los conceptos fundamentales que debe repasar urgentemente. Usa el {{promedio_curso}} para contextualizar el nivel esperado en la clase.'
    })
  },
  {
    nombre: 'Evaluación Corta',
    contenido: JSON.stringify({
      alto: 'Felicita brevemente a {{nombre_estudiante}} por conseguir {{calificacion}}, superando el {{promedio_curso}}. ¡Sigue así!',
      medio: 'Redacta un mensaje breve para {{nombre_estudiante}} sobre su desempeño ({{calificacion}}). Anímalo a subir su nivel respecto al {{promedio_curso}}.',
      bajo: 'Escribe una nota corta de apoyo a {{nombre_estudiante}}, quien obtuvo {{calificacion}}. El {{promedio_curso}} indica que es un tema complejo, ofrécele ayuda.'
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
