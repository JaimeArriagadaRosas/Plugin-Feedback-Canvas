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

    const placeholders = {
      '{{STUDENT_NAME}}': context.student?.name || 'Estudiante',
      '{{ASSIGNMENT_NAME}}': context.assignment?.name || 'Tarea',
      '{{COURSE_NAME}}': context.course?.name || 'Curso',
      '{{SUBMISSION_TEXT}}': context.submission?.body || context.submission?.description || 'Sin contenido',
      '{{RUBRIC_CRITERIA}}': this._formatRubric(context.rubric),
      '{{TEACHER_NOTES}}': context.teacherNotes || 'Sin notas adicionales',
      '{{STUDENT_LEVEL}}': context.profile?.level || 'No definido',
      '{{STUDENT_TREND}}': context.profile?.trend || 'Estable',
      '{{HISTORICAL_AVG}}': context.profile?.average || 'N/A',
      '{{TONE_INSTRUCTION}}': context.instructionIA || 'Mantén un tono profesional.',
      '{{CANVAS_SCORE}}': context.submission?.canvasScore != null ? String(context.submission.canvasScore) : 'N/A',
      '{{CHILE_GRADE}}': context.submission?.chileGrade != null ? String(context.submission.chileGrade) : 'N/A',
      '{{POINTS_POSSIBLE}}': context.submission?.pointsPossible != null ? String(context.submission.pointsPossible) : '100',
      '{{QUESTIONS_DETAIL}}': context.submission?.questionsDetail || 'Sin detalle de preguntas.',
      '{{CORRECT_COUNT}}': context.submission?.correctCount != null ? String(context.submission.correctCount) : 'N/A',
      '{{INCORRECT_COUNT}}': context.submission?.incorrectCount != null ? String(context.submission.incorrectCount) : 'N/A',
      '{{ACCURACY_PERCENT}}': context.submission?.accuracyPercent != null ? String(context.submission.accuracyPercent) : 'N/A'
    };

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
