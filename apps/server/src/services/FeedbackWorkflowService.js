import logger from '../utils/logger.js';
import { RichTextProcessor } from '../modules/formatting/RichTextProcessor.js';

export default class FeedbackWorkflowService {
  constructor(feedbackRepo, feedbackService, canvasService, preferencesService, emailService, diagnosticsService = null) {
    this.feedbackRepo = feedbackRepo;
    this.feedbackService = feedbackService;
    this.canvasService = canvasService;
    this.preferencesService = preferencesService;
    this.emailService = emailService;
    this.diagnosticsService = diagnosticsService;
  }

  /**
   * Rejects a feedback and requests its regeneration (RF27, RF67)
   */
  async rejectAndRegenerate(feedbackId, newVariables) {
    // Get original feedback BEFORE modifying it
    const fb = await this.feedbackRepo.getById(feedbackId);
    if (!fb) {
      throw new Error(`Feedback ${feedbackId} not found`);
    }
    const contenidoOriginal = fb.contenido_generado;

    // 1. Change status to REJECTED
    await this.feedbackRepo.updateStatusAndContent(feedbackId, 'RECHAZADO', 'Waiting for regeneration...');

    try {
      // 2. Regenerate feedback (RF67)
      const regenerated = await this.feedbackService.generateFeedback(
        fb.curso_id,
        fb.tarea_id,
        fb.estudiante_id,
        newVariables?.plantilla_id || fb.plantilla_id,
        fb.nota_canvas
      );
      return regenerated;
    } catch (error) {
      // If regeneration fails, restore original status and content to avoid losing it
      logger.warn(`[Workflow] Regeneration failed for feedback ${feedbackId}. Restoring original state.`, { error: error.message });
      await this.feedbackRepo.updateStatusAndContent(feedbackId, fb.estado, contenidoOriginal);
      throw error;
    }
  }

  /**
   * Massively approves and publishes a list of feedbacks (RF28)
   */
  async bulkApproveAndSend(feedbackIds, currentTeacherId = 'system') {
    let feedbacksToProcess = [];
    
    // 1. Phase A: Synchronous - Instant massive update
    await this.feedbackRepo.executeTransaction(async (client) => {
      const queryParams = feedbackIds.map((_, i) => `$${i + 1}`).join(',');
      const queryValues = [...feedbackIds];
      let teacherFilter = '';
      if (currentTeacherId !== 'system') {
        queryValues.push(currentTeacherId);
        teacherFilter = ` AND profesor_id = $${queryValues.length}`;
      }
      const res = await client.query(`
        SELECT id, estado, contenido_generado, curso_id, tarea_id, estudiante_id, profesor_id, nota_canvas 
        FROM Historial_Feedback_Generado 
        WHERE id IN (${queryParams})
          AND estado IN ('PENDIENTE', 'EDITADO')
          ${teacherFilter}
        FOR UPDATE
      `, queryValues);
      
      feedbacksToProcess = res.rows;
      if (feedbacksToProcess.length > 0) {
         const idsToUpdate = feedbacksToProcess.map(fb => fb.id);
         const updateParams = idsToUpdate.map((_, i) => `$${i + 1}`).join(',');
         await client.query(`UPDATE Historial_Feedback_Generado SET estado = 'APROBADO' WHERE id IN (${updateParams})`, idsToUpdate);
      }
    });

    // 2. Phase B: Asynchronous - Upload to Canvas
    if (feedbacksToProcess.length > 0) {
      if (this.diagnosticsService) {
        this.diagnosticsService.logBulkApproval(feedbacksToProcess, currentTeacherId);
      }
      this._processCanvasUploadsInBackground(feedbacksToProcess, currentTeacherId)
        .catch(err => logger.error('[Workflow] Fatal error in background Canvas process:', { error: err.message }));
    }

    return { status: 'processing', count: feedbacksToProcess.length };
  }

  async _processCanvasUploadsInBackground(feedbacksToProcess, currentTeacherId) {
    for (const fb of feedbacksToProcess) {
       let canvasPublished = false;
       try {
         const teacherToUse = currentTeacherId !== 'system' ? currentTeacherId : fb.profesor_id;
         
         // Canvas API calls
         const formattedContent = RichTextProcessor.process(fb.contenido_generado);
         await this.canvasService.postComment(fb.curso_id, fb.tarea_id, fb.estudiante_id, teacherToUse, formattedContent);
         if (fb.nota_canvas !== null && fb.nota_canvas !== undefined) {
            await this.canvasService.updateGrade(fb.curso_id, fb.tarea_id, fb.estudiante_id, teacherToUse, fb.nota_canvas);
         }
         canvasPublished = true;
         await this.feedbackRepo.updateStatusAndContent(fb.id, 'ENVIADO', fb.contenido_generado);

         // Get preference (RF43)
         let metodo = 'canvas_inapp';
         if (this.preferencesService) {
            const prefs = await this.preferencesService.getStudentPreference(fb.estudiante_id);
            metodo = prefs.metodo;
         }

         let notificationSuccess = false;

         // Send notification (RF42)
         const sendInApp = metodo === 'canvas_inapp' || metodo === 'both';
         const sendEmail = metodo === 'email' || metodo === 'both';
         
         let inAppSuccess = false;
         let emailSuccess = false;

         if (sendInApp && teacherToUse) {
            try {
              await this.canvasService.pushInAppMessage(
                fb.curso_id, fb.estudiante_id, teacherToUse,
                'New Feedback Available',
                'A new feedback has been published for your submission.'
              );
              inAppSuccess = true;
            } catch (msgErr) {
              logger.warn(`[Workflow] Error sending In-App Msg for feedback ${fb.id}`, { error: msgErr.message });
            }
         }
         
         if (sendEmail) {
            try {
               if (!this.emailService) throw new Error('Email provider not configured');
               await this.emailService.sendNotification(fb.estudiante_id, fb.curso_id, 'New Feedback Available');
               emailSuccess = true;
            } catch (e) {
               logger.warn(`[Workflow] Error sending email for feedback ${fb.id}`, { error: e.message });
            }
         }

         // Record notification (RF44)
         if (metodo !== 'none') {
            let metodoUsado = metodo;
            if (metodo === 'both') {
               metodoUsado = (inAppSuccess && emailSuccess) ? 'both' : (inAppSuccess ? 'canvas_inapp' : (emailSuccess ? 'email' : 'error_both'));
            } else if (metodo === 'canvas_inapp') {
               metodoUsado = inAppSuccess ? 'canvas_inapp' : 'error_canvas_inapp';
            } else if (metodo === 'email') {
               metodoUsado = emailSuccess ? 'email' : 'error_email';
            }
            await this.feedbackRepo.saveNotification(
              fb.estudiante_id, 
              fb.id, 
              `You have a new approved feedback in course ${fb.curso_id}`,
              metodoUsado
            );
         }
       } catch (error) {
         if (canvasPublished) {
           logger.error(`[Workflow] Canvas received feedback ${fb.id}, but a subsequent operation failed. Kept as SENT to avoid duplicates.`, { error: error.message });
           continue;
         }
         logger.error(`[Workflow] Error uploading feedback ${fb.id} to Canvas. Restoring ${fb.estado}...`, { error: error.message });
         try {
           await this.feedbackRepo.updateStatusAndContent(fb.id, fb.estado, fb.contenido_generado);
         } catch(rollbackErr) {
           logger.error(`[Workflow] Critical error reverting state for feedback ${fb.id}`, { error: rollbackErr.message });
         }
       }
    }
  }

}
