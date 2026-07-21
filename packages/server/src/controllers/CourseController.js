/**
 * Controlador de Cursos y Tareas (RF38, RF39, RF40)
 */
import { AppError } from '../utils/errors.js';
import logger from '../utils/logger.js';

export default class CourseController {
  constructor(canvasGateway, configRepo, templateRepo) {
    this.canvasGateway = canvasGateway;
    this.configRepo = configRepo;
    this.templateRepo = templateRepo;
  }

  async getCourses(req, res, next) {
    try {
      const userId = req.ltiContext?.user;
      if (!userId) {
        throw new AppError('No se pudo determinar el usuario (sub) desde el contexto LTI', 401);
      }
      
      logger.info(`[CourseController] Solicitando cursos para usuario: ${userId}`);
      const courses = await this.canvasGateway.getCourses(userId);
      logger.info(`[CourseController] Cursos obtenidos: ${courses?.length ?? 0} para usuario ${userId}`);
      res.json({ exito: true, data: courses });
    } catch (error) {
      logger.error(`[CourseController] Error al obtener cursos: ${error.message}`, { stack: error.stack });
      next(error);
    }
  }

  async getAssignments(req, res, next) {
    try {
      const { courseId } = req.params;
      const teacherId = req.ltiContext?.user;
      const assignments = await this.canvasGateway.getAssignments(courseId, teacherId);
      res.json({ exito: true, data: assignments });
    } catch (error) {
      next(error);
    }
  }

  async getStudents(req, res, next) {
    try {
      const { courseId } = req.params;
      const teacherId = req.ltiContext?.user;
      const students = await this.canvasGateway.getStudents(courseId, teacherId);
      res.json({ exito: true, data: students });
    } catch (error) {
      next(error);
    }
  }

  async getSubmission(req, res, next) {
    try {
      const { courseId, assignmentId, studentId } = req.params;
      const teacherId = req.ltiContext?.user;
      const submission = await this.canvasGateway._fetchWithToken(`/courses/${courseId}/assignments/${assignmentId}/submissions/${studentId}?include[]=submission_history&include[]=submission_comments`, teacherId);
      res.json({ exito: true, data: submission });
    } catch (error) {
      next(error);
    }
  }

  async togglePlugin(req, res, next) {
    try {
      const { courseId, assignmentId } = req.params;
      const { activo, plantilla_id, variables } = req.body;

      if (!courseId || !assignmentId) {
        return next(new AppError('courseId y assignmentId son requeridos', 400));
      }

      // Identidad real del usuario LTI en lugar de un ID fijo.
      // En modo local ltiContext.user es "local-user-<rol>"; en LTI real es el sub de Canvas.
      const profesorId = req.ltiContext?.user || req.body.profesorId || null;
      if (!profesorId) {
        return next(new AppError('No se pudo determinar el usuario desde el contexto LTI', 401));
      }

      // RF15: No se permite activar si no hay al menos 3 plantillas (rangos) configuradas
      if (activo && this.templateRepo) {
        const templates = await this.templateRepo.listAll();
        if (templates.length < 3) {
          return next(new AppError('No se puede activar el plugin. Se requieren al menos 3 plantillas configuradas para los diferentes rangos de calificación (ej. Malo, Regular, Bueno).', 400));
        }
      }

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
