import logger from '../utils/logger.js';
import { AppError } from '../utils/errors.js';

export default class PrivateNoteService {
  constructor(feedbackRepo) {
    this.feedbackRepo = feedbackRepo;
  }

  /**
   * Actualiza la nota privada asociada a un feedback
   */
  async updateNote(feedbackId, notaPrivada) {
    const fb = await this.feedbackRepo.getById(feedbackId);
    if (!fb) {
      throw new AppError(`Feedback ${feedbackId} no encontrado`, 404);
    }
    
    try {
      return await this.feedbackRepo.updatePrivateNote(feedbackId, notaPrivada);
    } catch (error) {
      logger.error(`[PrivateNoteService] Error actualizando nota para feedback ${feedbackId}`, { error: error.message });
      throw new AppError('Error actualizando nota privada en base de datos', 500);
    }
  }
}
