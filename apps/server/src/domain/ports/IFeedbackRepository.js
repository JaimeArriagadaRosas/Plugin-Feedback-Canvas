/**
 * Puerto (interface) para el repositorio de feedback.
 * 
 * Esta interfaz cumple con el Principio de Inversión de Dependencias (DIP):
 * los servicios de aplicación dependen de esta abstracción, no de la 
 * implementación concreta en `datos/FeedbackRepository.js`.
 */
export class IFeedbackRepository {
  async save(feedbackData) {
    throw new Error('Method not implemented');
  }
  async findByStudent(studentId, courseId) {
    throw new Error('Method not implemented');
  }
  async getStats() {
    throw new Error('Method not implemented');
  }
  async listAll() {
    throw new Error('Method not implemented');
  }
  async getById(id) {
    throw new Error('Method not implemented');
  }
  async updateStatusAndContent(id, estado, contenido) {
    throw new Error('Method not implemented');
  }
  async updateTeacherRating(id, rating) {
    throw new Error('Method not implemented');
  }
  async updateStudentRating(id, rating) {
    throw new Error('Method not implemented');
  }
  async saveNotification(studentId, feedbackId, mensaje, metodo = 'email') {
    throw new Error('Method not implemented');
  }
}