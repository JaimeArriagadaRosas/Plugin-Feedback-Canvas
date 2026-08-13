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
          `Validación fallida: ${parseResult.error.issues.map(i => i.message).join(', ')}`,
          400
        ));
      }
      const result = await this.workflowService.rejectAndRegenerate(id, parseResult.data);
      res.json({ exito: true, mensaje: 'Feedback rechazado y regenerado exitosamente', data: result });
    } catch (error) {
      next(error);
    }
  }

  async bulkApprove(req, res, next) {
    try {
      const { feedbackIds } = req.body;
      if (!Array.isArray(feedbackIds) || feedbackIds.length === 0) {
        return next(new AppError('Se requiere un arreglo no vacío de feedbackIds', 400));
      }

      // Validar que todos los elementos sean enteros positivos
      const allValid = feedbackIds.every(id => Number.isInteger(Number(id)) && Number(id) > 0);
      if (!allValid) {
        return next(new AppError('Todos los feedbackIds deben ser enteros positivos', 400));
      }

      if (feedbackIds.length > 100) {
        return next(new AppError('Máximo 100 feedbackIds por solicitud', 400));
      }

      const teacherId = req.appIdentity?.ltiUserId || req.appIdentity?.canonicalUserId || 'system';

      // Esperamos a que termine la Fase A (actualización en BD a APROBADO).
      // La Fase B (envío a Canvas) seguirá corriendo en segundo plano dentro del servicio.
      const result = await this.workflowService.bulkApproveAndSend(feedbackIds, teacherId);
      
      res.status(202).json({
        exito: true,
        mensaje: 'Feedbacks encolados. El envío a Canvas se está procesando en segundo plano.',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

}
