import { z } from 'zod';
import { AppError } from '../utils/errors.js';



const rejectFeedbackSchema = z.object({
  plantilla_id: z.number().int().positive().optional(),
}).strict();

export default class AdvancedFeedbackController {
  constructor(feedbackWorkflowService) {
    this.workflowService = feedbackWorkflowService;
  }

  async rejectFeedback(req, res, next) {
    try {
      const { id } = req.params;
      const parseResult = rejectFeedbackSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(new AppError(
          `Validation failed: ${parseResult.error.issues.map(i => i.message).join(', ')}`,
          400
        ));
      }
      const result = await this.workflowService.rejectAndRegenerate(id, parseResult.data);
      res.json({ exito: true, mensaje: 'Feedback successfully rejected and regenerated', data: result });
    } catch (error) {
      next(error);
    }
  }

  async bulkApprove(req, res, next) {
    try {
      const { feedbackIds } = req.body;
      if (!Array.isArray(feedbackIds) || feedbackIds.length === 0) {
        return next(new AppError('A non-empty array of feedbackIds is required', 400));
      }

      // Validate that all elements are positive integers
      const allValid = feedbackIds.every(id => Number.isInteger(Number(id)) && Number(id) > 0);
      if (!allValid) {
        return next(new AppError('All feedbackIds must be positive integers', 400));
      }

      if (feedbackIds.length > 100) {
        return next(new AppError('Maximum 100 feedbackIds per request', 400));
      }

      const teacherId = req.appIdentity?.ltiUserId || req.appIdentity?.canonicalUserId || 'system';

      // Wait for Phase A to finish (DB update to APPROVED).
      // Phase B (send to Canvas) will continue running in the background within the service.
      const result = await this.workflowService.bulkApproveAndSend(feedbackIds, teacherId);
      
      res.status(202).json({
        exito: true,
        mensaje: 'Feedback queued. Submission to Canvas is processing in the background.',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

}
