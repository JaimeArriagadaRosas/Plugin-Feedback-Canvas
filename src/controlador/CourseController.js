/**
 * Controlador de Cursos y Tareas (RF38, RF39, RF40)
 */
export default class CourseController {
  constructor(canvasService, configRepo) {
    this.canvasService = canvasService;
    this.configRepo = configRepo;
  }

  async getCourses(req, res, next) {
    try {
      const courses = await this.canvasService.getCourses();
      res.json({ exito: true, data: courses });
    } catch (error) {
      next(error);
    }
  }

  async getAssignments(req, res, next) {
    try {
      const { courseId } = req.params;
      const assignments = await this.canvasService.getAssignments(courseId);
      res.json({ exito: true, data: assignments });
    } catch (error) {
      next(error);
    }
  }

  async getStudents(req, res, next) {
    try {
      const { courseId } = req.params;
      const students = await this.canvasService.getStudents(courseId);
      res.json({ exito: true, data: students });
    } catch (error) {
      next(error);
    }
  }

  async getSubmission(req, res, next) {
    try {
      const { courseId, assignmentId, studentId } = req.params;
      const submission = await this.canvasService.getSubmission(courseId, assignmentId, studentId);
      res.json({ exito: true, data: submission });
    } catch (error) {
      next(error);
    }
  }

  async togglePlugin(req, res, next) {
    try {
      const { courseId, assignmentId } = req.params;
      const { activo, plantilla_id, variables } = req.body; 
      
      // En un entorno real se extraería el ID interno del profesor usando req.ltiContext.user
      // Por ahora, en entorno mock, asignaremos 1 (Admin/Teacher)
      const profesorId = 1; 
      
      const configAsig = await this.configRepo.saveConfigAsignacion(
        courseId, 
        assignmentId, 
        { feedback_activo: activo, plantilla_id: plantilla_id || null }, 
        profesorId
      );
      
      if (variables && Array.isArray(variables)) {
        await this.configRepo.saveVariablesAsignacion(configAsig.id_configuracion, variables);
      }
      
      const fullConfig = await this.configRepo.getConfigAsignacion(courseId, assignmentId);
      
      res.json({ 
        exito: true, 
        mensaje: `Plugin ${activo ? 'activado' : 'desactivado'} para la tarea`,
        data: fullConfig 
      });
    } catch (error) {
      next(error);
    }
  }
}
