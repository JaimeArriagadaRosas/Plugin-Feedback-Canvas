/**
 * Motor de Prompts IA (Versión Mejorada)
 * Construye prompts complejos combinando contexto, rangos y perfiles.
 */
export default class PromptManager {
  /**
   * Genera un prompt avanzado con contexto psicopedagógico
   */
  static buildPrompt(template, context) {
    let prompt = template;

    // Placeholders avanzados
    const placeholders = {
      '{{STUDENT_NAME}}': context.student?.name || 'Estudiante',
      '{{ASSIGNMENT_NAME}}': context.assignment?.name || 'Tarea',
      '{{COURSE_NAME}}': context.course?.name || 'Curso',
      '{{SUBMISSION_TEXT}}': context.submission?.body || context.submission?.description || 'Sin contenido',
      '{{RUBRIC_CRITERIA}}': this._formatRubric(context.rubric),
      '{{TEACHER_NOTES}}': context.teacherNotes || 'Sin notas adicionales',
      
      // Nuevos Placeholders de Inteligencia Académica
      '{{STUDENT_LEVEL}}': context.profile?.level || 'No definido',
      '{{STUDENT_TREND}}': context.profile?.trend || 'Estable',
      '{{HISTORICAL_AVG}}': context.profile?.average || 'N/A',
      '{{TONE_INSTRUCTION}}': context.instructionIA || 'Mantén un tono profesional.'
    };

    // Reemplazo dinámico
    Object.keys(placeholders).forEach(key => {
      prompt = prompt.split(key).join(placeholders[key]);
    });

    return prompt;
  }

  /**
   * Formatea los criterios de la rúbrica para ser legibles por la IA
   */
  static _formatRubric(rubric) {
    if (!rubric || !Array.isArray(rubric)) return 'No se proporcionó rúbrica.';
    
    return rubric.map(crit => {
      return `- Criterio: ${crit.description}\n  Puntos: ${crit.points}\n  Comentario previo: ${crit.comments || 'Ninguno'}`;
    }).join('\n');
  }
}
