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
   * Rechaza un feedback y solicita su regeneración (RF27, RF67)
   */
  async rejectAndRegenerate(feedbackId, newVariables) {
    // Obtener el feedback original ANTES de modificarlo
    const fb = await this.feedbackRepo.getById(feedbackId);
    if (!fb) {
      throw new Error(`Feedback ${feedbackId} no encontrado`);
    }
    const contenidoOriginal = fb.contenido_generado;

    // 1. Cambiar estado a RECHAZADO
    await this.feedbackRepo.updateStatusAndContent(feedbackId, 'RECHAZADO', 'Esperando regeneración...');

    try {
      // 2. Regenerar el feedback (RF67)
      const regenerated = await this.feedbackService.generateFeedback(
        fb.curso_id,
        fb.tarea_id,
        fb.estudiante_id,
        newVariables?.plantilla_id || fb.plantilla_id,
        fb.nota_canvas
      );
      return regenerated;
    } catch (error) {
      // Si la regeneración falla, restaurar el estado y contenido original para no perderlo
      logger.warn(`[Workflow] Regeneración fallida para feedback ${feedbackId}. Restaurando estado original.`, { error: error.message });
      await this.feedbackRepo.updateStatusAndContent(feedbackId, fb.estado, contenidoOriginal);
      throw error;
    }
  }

  /**
   * Aprueba y publica masivamente una lista de feedbacks (RF28)
   */
  async bulkApproveAndSend(feedbackIds, currentTeacherId = 'system') {
    let feedbacksToProcess = [];
    
    // 1. Fase A: Síncrona - Actualización masiva instantánea
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

    // 2. Fase B: Asíncrona - Subida a Canvas
    if (feedbacksToProcess.length > 0) {
      if (this.diagnosticsService) {
        this.diagnosticsService.logBulkApproval(feedbacksToProcess, currentTeacherId);
      }
      this._processCanvasUploadsInBackground(feedbacksToProcess, currentTeacherId)
        .catch(err => logger.error('[Workflow] Error fatal en proceso de fondo Canvas:', { error: err.message }));
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

         // Obtener preferencia (RF43)
         let metodo = 'canvas_inapp';
         if (this.preferencesService) {
            const prefs = await this.preferencesService.getStudentPreference(fb.estudiante_id);
            metodo = prefs.metodo;
         }

         let notificationSuccess = false;

         // Enviar notificación (RF42)
         const sendInApp = metodo === 'canvas_inapp' || metodo === 'both';
         const sendEmail = metodo === 'email' || metodo === 'both';
         
         let inAppSuccess = false;
         let emailSuccess = false;

         if (sendInApp && teacherToUse) {
            try {
              await this.canvasService.pushInAppMessage(
                fb.curso_id, fb.estudiante_id, teacherToUse,
                'Nuevo Feedback Disponible',
                'Se ha publicado un nuevo feedback para tu entrega.'
              );
              inAppSuccess = true;
            } catch (msgErr) {
              logger.warn(`[Workflow] Error enviando In-App Msg para feedback ${fb.id}`, { error: msgErr.message });
            }
         }
         
         if (sendEmail) {
            try {
               if (!this.emailService) throw new Error('Proveedor de correo no configurado');
               await this.emailService.sendNotification(fb.estudiante_id, fb.curso_id, 'Nuevo Feedback Disponible');
               emailSuccess = true;
            } catch (e) {
               logger.warn(`[Workflow] Error enviando correo para feedback ${fb.id}`, { error: e.message });
            }
         }

         // Registrar notificación (RF44)
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
              `Tienes un nuevo feedback aprobado en el curso ${fb.curso_id}`,
              metodoUsado
            );
         }
       } catch (error) {
         if (canvasPublished) {
           logger.error(`[Workflow] Canvas recibió el feedback ${fb.id}, pero falló una operación posterior. Se conserva ENVIADO para evitar duplicados.`, { error: error.message });
           continue;
         }
         logger.error(`[Workflow] Error subiendo a Canvas feedback ${fb.id}. Restaurando ${fb.estado}...`, { error: error.message });
         try {
           await this.feedbackRepo.updateStatusAndContent(fb.id, fb.estado, fb.contenido_generado);
         } catch(rollbackErr) {
           logger.error(`[Workflow] Error crítico revirtiendo estado para feedback ${fb.id}`, { error: rollbackErr.message });
         }
       }
    }
  }

}
