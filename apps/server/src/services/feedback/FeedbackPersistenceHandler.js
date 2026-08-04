import logger from '../../utils/logger.js';

export default class FeedbackPersistenceHandler {
  constructor(feedbackRepo) {
    this.feedbackRepo = feedbackRepo;
  }

  /**
   * Guarda o actualiza el feedback generado en la base de datos
   */
  async saveGeneratedFeedback(params) {
    const { 
      pending, courseId, assignmentId, studentId, teacherId, 
      finalCourseName, finalAssignmentName, finalStudentName, 
      templateId, feedbackText, prompt, canvasScore, chileGrade, approved 
    } = params;

    let saved;
    if (pending) {
      saved = await this.feedbackRepo.updateGeneratedFeedback(pending.id, {
        contenidoGenerado: feedbackText,
        promptUsado: prompt,
        notaCanvas: canvasScore,
        notaChile: chileGrade,
        aprobado: approved
      });
    } else {
      saved = await this.feedbackRepo.save({
        cursoId: courseId,
        tareaId: assignmentId,
        estudianteId: studentId,
        profesorId: teacherId,
        nombreCurso: finalCourseName,
        nombreTarea: finalAssignmentName,
        nombreEstudiante: finalStudentName,
        plantillaId: templateId,
        contenidoGenerado: feedbackText,
        promptUsado: prompt,
        notaCanvas: canvasScore,
        notaChile: chileGrade,
        aprobado: approved
      });
    }

    return saved;
  }
}
