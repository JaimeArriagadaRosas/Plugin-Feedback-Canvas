import logger from '../utils/logger.js';

export default class CourseService {
  constructor(configRepo) {
    this.configRepo = configRepo;
  }

  async togglePlugin(courseId, assignmentId, activo, plantilla_id, variables, profesorId) {
    const existing = await this.configRepo.getConfigAsignacion(courseId, assignmentId);
    const finalPlantillaId = (plantilla_id !== undefined && plantilla_id !== null && plantilla_id !== "")
      ? plantilla_id
      : (existing && existing.plantilla_id ? existing.plantilla_id : null);

    const configAsig = await this.configRepo.saveConfigAsignacion(
      courseId,
      assignmentId,
      { feedback_activo: activo, plantilla_id: finalPlantillaId },
      profesorId
    );

    if (variables && Array.isArray(variables)) {
      await this.configRepo.saveVariablesAsignacion(configAsig.id_configuracion, variables);
    }

    return this.configRepo.getConfigAsignacion(courseId, assignmentId);
  }

  async resetActiveAssignments(courseId, profesorId) {
    if (this.configRepo && typeof this.configRepo.resetActiveByCourse === 'function') {
      await this.configRepo.resetActiveByCourse(courseId, profesorId);
    }
    logger.info(`[CourseService] Active status of assignments reset to false for course ${courseId} and teacher ${profesorId}`);
  }
}
