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

  async togglePlugin(req, res, next) {
    try {
      const { assignmentId } = req.params;
      const { activo } = req.body; // true o false
      
      const config = await this.configRepo.saveOrUpdate('tarea', assignmentId, { pluginActivo: activo });
      
      res.json({ 
        exito: true, 
        mensaje: `Plugin ${activo ? 'activado' : 'desactivado'} para la tarea`,
        data: config 
      });
    } catch (error) {
      next(error);
    }
  }
}
