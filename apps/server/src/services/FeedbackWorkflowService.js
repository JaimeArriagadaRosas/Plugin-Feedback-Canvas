import logger from '../utils/logger.js';

export default class FeedbackWorkflowService {
  constructor(feedbackRepo, feedbackService, canvasService) {
    this.feedbackRepo = feedbackRepo;
    this.feedbackService = feedbackService;
    this.canvasService = canvasService;
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
        fb.plantilla_id,
        newVariables?.nota_obtenida || fb.nota_canvas
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
      const res = await client.query(`
        SELECT id, estado, contenido_generado, curso_id, tarea_id, estudiante_id, profesor_id, nota_canvas 
        FROM Historial_Feedback_Generado 
        WHERE id IN (${queryParams}) AND estado = 'PENDIENTE'
        FOR UPDATE
      `, feedbackIds);
      
      feedbacksToProcess = res.rows;
      if (feedbacksToProcess.length > 0) {
         const idsToUpdate = feedbacksToProcess.map(fb => fb.id);
         const updateParams = idsToUpdate.map((_, i) => `$${i + 1}`).join(',');
         await client.query(`UPDATE Historial_Feedback_Generado SET estado = 'APROBADO' WHERE id IN (${updateParams})`, idsToUpdate);
      }
    });

    // 2. Fase B: Asíncrona - Subida a Canvas
    if (feedbacksToProcess.length > 0) {
      this._processCanvasUploadsInBackground(feedbacksToProcess, currentTeacherId)
        .catch(err => logger.error('[Workflow] Error fatal en proceso de fondo Canvas:', { error: err.message }));
    }

    return { status: 'processing', count: feedbacksToProcess.length };
  }

  async _processCanvasUploadsInBackground(feedbacksToProcess, currentTeacherId) {
    for (const fb of feedbacksToProcess) {
       try {
         const teacherToUse = currentTeacherId !== 'system' ? currentTeacherId : fb.profesor_id;
         
         // Canvas API calls
         await this.canvasService.postComment(fb.curso_id, fb.tarea_id, fb.estudiante_id, teacherToUse, fb.contenido_generado);
         if (fb.nota_canvas !== null && fb.nota_canvas !== undefined) {
            await this.canvasService.updateGrade(fb.curso_id, fb.tarea_id, fb.estudiante_id, teacherToUse, fb.nota_canvas);
         }

         // Notifications
         await this.feedbackRepo.saveNotification(
           fb.estudiante_id, 
           fb.id, 
           `Tienes un nuevo feedback aprobado en el curso ${fb.curso_id}`
         );
         
         if (teacherToUse) {
            try {
              await this.canvasService.pushInAppMessage(
                fb.curso_id, fb.estudiante_id, teacherToUse,
                'Nuevo Feedback Disponible',
                'Se ha publicado un nuevo feedback para tu entrega.'
              );
            } catch (msgErr) {
              logger.warn(`[Workflow] Error enviando In-App Msg para feedback ${fb.id}`, { error: msgErr.message });
            }
         }
       } catch (error) {
         logger.error(`[Workflow] Error subiendo a Canvas feedback ${fb.id}. Revirtiendo a PENDIENTE...`, { error: error.message });
         try {
           await this.feedbackRepo.updateStatusAndContent(fb.id, 'PENDIENTE', fb.contenido_generado);
         } catch(rollbackErr) {
           logger.error(`[Workflow] Error crítico revirtiendo estado para feedback ${fb.id}`, { error: rollbackErr.message });
         }
       }
    }
  }

  /**
   * Actualiza la nota privada asociada a un feedback (RF31)
   */
  async updatePrivateNote(feedbackId, notaPrivada) {
    const fb = await this.feedbackRepo.getById(feedbackId);
    if (!fb) {
      throw new Error(`Feedback ${feedbackId} no encontrado`);
    }
    return await this.feedbackRepo.updatePrivateNote(feedbackId, notaPrivada);
  }
}
