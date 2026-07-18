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

    // Sanitización básica para prevenir Prompt Injection
    // Evita que un estudiante inserte delimitadores como ``` o system prompts simulados.
    const sanitize = (val) => {
      if (typeof val !== 'string') return val;
      return val
        .replace(/```/g, "'''")
        .replace(/{{/g, '{ {')
        .replace(/}}/g, '} }')
        .replace(/\[INST\]/ig, '[ INST ]')
        .replace(/<system>/ig, '< system >')
        .replace(/<\/system>/ig, '< /system >');
    };

    const placeholders = {
      // Variables del backend (Inglés)
      '{{STUDENT_NAME}}': sanitize(context.student?.name) || 'Estudiante',
      '{{ASSIGNMENT_NAME}}': sanitize(context.assignment?.name) || 'Tarea',
      '{{COURSE_NAME}}': sanitize(context.course?.name) || 'Curso',
      '{{SUBMISSION_TEXT}}': sanitize(context.submission?.body || context.submission?.description) || 'Sin contenido',
      '{{RUBRIC_CRITERIA}}': sanitize(this._formatRubric(context.rubric)),
      '{{TEACHER_NOTES}}': sanitize(context.teacherNotes) || 'Sin notas adicionales',
      '{{STUDENT_LEVEL}}': sanitize(context.profile?.level) || 'No definido',
      '{{STUDENT_TREND}}': sanitize(context.profile?.trend) || 'Estable',
      '{{HISTORICAL_AVG}}': sanitize(context.profile?.average) || 'N/A',
      '{{TONE_INSTRUCTION}}': sanitize(context.instructionIA) || 'Mantén un tono profesional.',
      '{{CANVAS_SCORE}}': context.submission?.canvasScore != null ? String(context.submission.canvasScore) : 'N/A',
      '{{CHILE_GRADE}}': context.submission?.chileGrade != null ? String(context.submission.chileGrade) : 'N/A',
      '{{POINTS_POSSIBLE}}': context.submission?.pointsPossible != null ? String(context.submission.pointsPossible) : '100',
      '{{QUESTIONS_DETAIL}}': sanitize(context.submission?.questionsDetail) || 'Sin detalle de preguntas.',
      '{{CORRECT_COUNT}}': context.submission?.correctCount != null ? String(context.submission.correctCount) : 'N/A',
      '{{INCORRECT_COUNT}}': context.submission?.incorrectCount != null ? String(context.submission.incorrectCount) : 'N/A',
      '{{ACCURACY_PERCENT}}': context.submission?.accuracyPercent != null ? String(context.submission.accuracyPercent) : 'N/A',
      // Variables del frontend (Español) - RF12
      '{{nombre_estudiante}}': sanitize(context.student?.name) || 'Estudiante',
      '{{calificacion}}': context.submission?.canvasScore != null ? String(context.submission.canvasScore) : 'N/A',
      '{{promedio_curso}}': sanitize(context.profile?.average) || 'N/A',
    };

    Object.keys(placeholders).forEach(key => {
      // Reemplazo global
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
