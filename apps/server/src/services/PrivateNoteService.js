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
      throw new AppError(`Feedback ${feedbackId} not found`, 404);
    }
    
    try {
      return await this.feedbackRepo.updatePrivateNote(feedbackId, notaPrivada);
    } catch (error) {
      logger.error(`[PrivateNoteService] Error updating private note for feedback ${feedbackId}`, { error: error.message });
      throw new AppError('Error updating private note in the database', 500);
    }
  }
}
