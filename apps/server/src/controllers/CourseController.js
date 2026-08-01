/**
 * Controlador de Cursos y Tareas (RF38, RF39, RF40)
 */
import { AppError } from '../utils/errors.js';
import logger from '../utils/logger.js';

export default class CourseController {
  constructor(canvasGateway, configRepo, templateRepo, courseService) {
    this.canvasGateway = canvasGateway;
    this.configRepo = configRepo;
    this.templateRepo = templateRepo;
    this.courseService = courseService;
  }

  async getCourses(req, res, next) {
    try {
      const userId = req.appIdentity?.ltiUserId || req.appIdentity?.canonicalUserId;
      if (!userId) {
        throw new AppError('No se pudo determinar el usuario (sub) desde el contexto LTI', 401);
      }
      
      const courses = await this.canvasGateway.getCourses(userId);
      logger.info(`[COURSES] Retornados ${courses?.length ?? 0} cursos para el usuario: ${userId?.substring(0,8)}...`);
      res.json({ exito: true, data: courses });
    } catch (error) {
      logger.error(`[CourseController] Error al obtener cursos: ${error.message}`, { stack: error.stack });
      next(error);
    }
  }

  async getAssignments(req, res, next) {
    try {
      const { courseId } = req.params;
      const teacherId = req.appIdentity?.ltiUserId || req.appIdentity?.canonicalUserId;
      let assignments = await this.canvasGateway.getAssignments(courseId, teacherId);

      const localConfigs = await this.configRepo.getConfigsByCourse(courseId);
      const configMap = new Map();
      (localConfigs || []).forEach(c => configMap.set(String(c.canvas_assignment_id), c));

      if (!Array.isArray(assignments)) {
        assignments = [];
      }

      assignments = await Promise.all(assignments.map(async a => {
        const local = configMap.get(String(a.id));
        let templateName = "";
        if (local && local.plantilla_id) {
          try {
            const template = await this.templateRepo.getById(local.plantilla_id);
            if (template) templateName = template.nombre;
          } catch (e) {
            logger.error(`Error fetching template ${local.plantilla_id}: ${e.message}`);
          }
        }
        return {
          ...a,
          active: local ? Boolean(local.feedback_activo) : false,
          template: local && local.plantilla_id ? String(local.plantilla_id) : "",
          templateName
        };
      }));

      res.json({ exito: true, data: assignments });
    } catch (error) {
      logger.error('Error al obtener assignments', { error: error.message, courseId: req.params.courseId });
      next(error);
    }
  }

  async getStudents(req, res, next) {
    try {
      const { courseId } = req.params;
      const teacherId = req.appIdentity?.ltiUserId || req.appIdentity?.canonicalUserId;
      const students = await this.canvasGateway.getStudents(courseId, teacherId);
      res.json({ exito: true, data: students });
    } catch (error) {
      logger.error('Error al obtener estudiantes', { error: error.message, courseId: req.params.courseId });
      next(error);
    }
  }

  async getSubmission(req, res, next) {
    try {
      const { courseId, assignmentId, studentId } = req.params;
      const teacherId = req.appIdentity?.ltiUserId || req.appIdentity?.canonicalUserId;
      const submission = await this.canvasGateway.getSubmission(courseId, assignmentId, studentId, teacherId);
      
      // Diagnóstico: loguear campos críticos de la submission para depuración de renderizado
      const diagAttachments = submission.attachments?.length || 0;
      const diagType = submission.submission_type || 'N/A';
      const diagHasBody = !!submission.body;
      const diagHasPreview = !!submission.preview_url;
      logger.debug('[SUBMISSION]', { type: diagType, attachments: diagAttachments, has_body: diagHasBody, has_preview_url: diagHasPreview, student: studentId });
      
      res.json({ exito: true, data: submission });
    } catch (error) {
      logger.error('Error al obtener entrega', { error: error.message, courseId: req.params.courseId, studentId: req.params.studentId });
      next(error);
    }
  }

  async getQuizDetails(req, res, next) {
    try {
      const { courseId, assignmentId, studentId } = req.params;
      const teacherId = req.appIdentity?.ltiUserId || req.appIdentity?.canonicalUserId;
      
      // Obtener la entrega del estudiante (para saber la versión del quiz_submission)
      const submission = await this.canvasGateway.getSubmission(courseId, assignmentId, studentId, teacherId);
      
      // Obtener las preguntas del quiz (usando el gateway existente)
      const questions = await this.canvasGateway.getQuizQuestions(courseId, assignmentId, teacherId);

      // Extraer datos útiles del historial de envíos de la entrega para relacionarlos con las preguntas
      // Si el historial existe, mapeamos las respuestas del estudiante
      const history = submission?.submission_history || [];
      const latestAttempt = history.length > 0 ? history[history.length - 1] : null;

      res.json({ 
        exito: true, 
        data: {
          submission,
          questions,
          latestAttempt
        } 
      });
    } catch (error) {
      logger.error(`[CourseController] Error en getQuizDetails: ${error.message}`, { stack: error.stack });
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
      const profesorId = req.appIdentity?.ltiUserId || req.appIdentity?.canonicalUserId || req.body.profesorId || null;
      if (!profesorId) {
        return next(new AppError('No se pudo determinar el usuario desde el contexto LTI', 401));
      }



      const fullConfig = await this.courseService.togglePlugin(
        courseId, assignmentId, activo, plantilla_id, variables, profesorId
      );

      res.json({
        exito: true,
        mensaje: `Plugin ${activo ? 'activado' : 'desactivado'} para la tarea`,
        data: fullConfig
      });
    } catch (error) {
      logger.error('Error en togglePlugin', { error: error.message, courseId: req.params.courseId, assignmentId: req.params.assignmentId });
      next(error);
    }
  }

  async resetActiveAssignments(req, res, next) {
    try {
      const { courseId } = req.params;
      const profesorId = req.appIdentity?.ltiUserId || req.appIdentity?.canonicalUserId || req.body.profesorId || null;
      if (!profesorId) {
        return next(new AppError('No se pudo determinar el usuario desde el contexto LTI', 401));
      }

      if (this.courseService) {
        await this.courseService.resetActiveAssignments(courseId, profesorId);
      }

      res.json({ exito: true, mensaje: 'Sesión iniciada: tareas desactivadas por defecto en esta sesión.' });
    } catch (error) {
      logger.error(`[CourseController] Error al reiniciar estado de tareas: ${error.message}`);
      next(error);
    }
  }
}
