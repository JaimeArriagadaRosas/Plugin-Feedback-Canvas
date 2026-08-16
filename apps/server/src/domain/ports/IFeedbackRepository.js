/**
 * Port (interface) for the feedback repository.
 * 
 * This interface fulfills the Dependency Inversion Principle (DIP):
 * application services depend on this abstraction, not on the 
 * concrete implementation in `datos/FeedbackRepository.js`.
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