import sanitizeHtml from 'sanitize-html';
import { AppError } from '../utils/errors.js';

/**
 * Controlador de Respaldo Manual (RF62)
 *
 * Capa fina: delega toda la lógica (persistencia + envío a Canvas)
 * al FeedbackService. No accede a repositorios ni a Canvas directamente.
 */
export default class ManualFeedbackController {
  constructor(feedbackService) {
    this.feedbackService = feedbackService;
  }

  async submitManualFeedback(req, res, next) {
    try {
      const { courseId, assignmentId, studentId, content, grade } = req.body;

      if (grade !== undefined && grade !== null) {
        const numGrade = Number(grade);
        if (Number.isNaN(numGrade) || numGrade < 0 || numGrade > 100) {
          throw new AppError('La calificación debe ser un número entre 0 y 100', 400);
        }
      }

      const teacherId = req.appIdentity?.ltiUserId || req.appIdentity?.canonicalUserId || 'system';
      if (!courseId || !assignmentId || !studentId || !teacherId) {
        throw new AppError('courseId, assignmentId, studentId y teacherId son obligatorios', 400);
      }
      
      const sanitizedContent = sanitizeHtml(content, {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
        allowedAttributes: {
          ...sanitizeHtml.defaults.allowedAttributes,
          '*': ['style']
        }
      });

      const fbGuardado = await this.feedbackService.submitManualFeedback({ courseId, assignmentId, studentId, teacherId, contenidoManual: sanitizedContent, grade });
      res.json({ exito: true, mensaje: 'Feedback manual guardado como pendiente', data: fbGuardado });
    } catch (error) {
      next(error);
    }
  }
}
