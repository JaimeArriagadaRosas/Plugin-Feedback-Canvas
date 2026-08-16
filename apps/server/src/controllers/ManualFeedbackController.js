import sanitizeHtml from 'sanitize-html';
import { AppError } from '../utils/errors.js';

/**
 * Manual Backup Controller (RF62)
 *
 * Thin layer: delegates all logic (persistence + send to Canvas)
 * to FeedbackService. Does not access repositories or Canvas directly.
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
          throw new AppError('The grade must be a number between 0 and 100', 400);
        }
      }

      const teacherId = req.appIdentity?.ltiUserId || req.appIdentity?.canonicalUserId || 'system';
      if (!courseId || !assignmentId || !studentId || !teacherId) {
        throw new AppError('courseId, assignmentId, studentId and teacherId are required', 400);
      }
      
      const sanitizedContent = sanitizeHtml(content, {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
        allowedAttributes: {
          ...sanitizeHtml.defaults.allowedAttributes,
          '*': ['style']
        }
      });

      const fbGuardado = await this.feedbackService.submitManualFeedback({
        courseId,
        assignmentId,
        studentId,
        teacherId,
        contenidoManual: sanitizedContent,
        grade
      });
      res.json({ exito: true, mensaje: 'Manual feedback saved as pending', data: fbGuardado });
    } catch (error) {
      next(error);
    }
  }
}
