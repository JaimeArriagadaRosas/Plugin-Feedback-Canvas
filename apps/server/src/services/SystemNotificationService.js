export default class SystemNotificationService {
  constructor(notificationRepo) {
    this.notificationRepo = notificationRepo;
  }

  async saveNotification(profesorId, tipoError, detalle, contexto = {}) {
    if (!profesorId || profesorId === 'system') return; // En scripts background puros puede no haber profe
    return this.notificationRepo.save(profesorId, tipoError, detalle, contexto);
  }

  async getPendingCounts(profesorId) {
    if (!profesorId || profesorId === 'system') return [];
    return this.notificationRepo.getPendingCounts(profesorId);
  }

  async clearPending(profesorId, tipoError) {
    if (!profesorId || profesorId === 'system') return;
    return this.notificationRepo.clearPending(profesorId, tipoError);
  }

  async getForCourse(profesorId, courseId) {
    return this.notificationRepo.getForCourse(profesorId, courseId);
  }
}
