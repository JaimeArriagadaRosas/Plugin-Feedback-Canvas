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
  async bulkApproveAndSend(feedbackIds) {
    const results = [];
    for (const id of feedbackIds) {
      try {
        // Ejecutar en transacción para evitar condición de carrera y des-sincronización
        await this.feedbackRepo.executeTransaction(async (client) => {
          // Bloquear la fila para actualización
          const res = await client.query('SELECT estado, contenido_generado, curso_id, tarea_id, estudiante_id FROM Historial_Feedback_Generado WHERE id = $1 FOR UPDATE', [id]);
          const fb = res.rows[0];
          
          if (!fb || fb.estado === 'APROBADO' || fb.estado === 'ENVIADO') {
            throw new Error('Feedback ya fue procesado o no existe');
          }

          // 1. Actualizar BD
          await client.query('UPDATE Historial_Feedback_Generado SET estado = $1 WHERE id = $2', ['APROBADO', id]);

          // 2. Publicar en Canvas
          await this.canvasService.postComment(fb.curso_id, fb.tarea_id, fb.estudiante_id, fb.contenido_generado);
        });

        results.push({ id, status: 'success' });
      } catch (error) {
        logger.error(`Error en aprobación masiva para feedback ${id}:`, { error: error.message });
        results.push({ id, status: 'error', error: error.message });
      }
    }
    return results;
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
