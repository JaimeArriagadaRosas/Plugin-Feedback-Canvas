import sanitizeHtml from 'sanitize-html';

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
      
      const sanitizedContent = sanitizeHtml(content, {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
        allowedAttributes: {
          ...sanitizeHtml.defaults.allowedAttributes,
          '*': ['style']
        }
      });

      await this.feedbackService.submitManualFeedback({ courseId, assignmentId, studentId, contenidoManual: sanitizedContent, grade });
      res.json({ exito: true, mensaje: 'Feedback manual sincronizado con Canvas (RF62)' });
    } catch (error) {
      next(error);
    }
  }
}
