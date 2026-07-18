/**
 * Controlador de Feedback (RF23, RF24, RF25, RF26, RF30, RF31)
 *
 * Capa fina: valida el transporte (req/res) y delega toda la lógica
 * de negocio al FeedbackService. No accede a repositorios ni a Canvas.
 */
export default class FeedbackController {
  constructor(feedbackService, canvasService) {
    this.feedbackService = feedbackService;
    this.canvasService = canvasService;
  }

  async listPending(req, res, next) {
    try {
      const data = await this.feedbackService.getStats();
      res.json({ exito: true, data });
    } catch (error) {
      next(error);
    }
  }

  async listAll(req, res, next) {
    try {
      const data = await this.feedbackService.getListAll();
      res.json({ exito: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getDetail(req, res, next) {
    try {
      const { studentId, courseId } = req.query;

      // IDOR prevention
      const roles = req.ltiContext?.role || [];
      const roleList = Array.isArray(roles) ? roles : [roles];
      const isStudentRole = req.ltiContext?.localRole === 'student'
        || roleList.some(r => typeof r === 'string' && r.toLowerCase().includes('learner'));

      if (isStudentRole && String(req.ltiContext?.user) !== String(studentId)) {
        const { AppError } = await import('../utils/errors.js');
        throw new AppError('Acceso prohibido al detalle del feedback de otro estudiante', 403);
      }

      const data = await this.feedbackService.findByStudent(studentId, courseId);
      res.json({ exito: true, data });
    } catch (error) {
      next(error);
    }
  }

  async generate(req, res, next) {
    try {
      const { courseId, assignmentId, studentId, templateId, grade } = req.body;
      const result = await this.feedbackService.generateFeedback(courseId, assignmentId, studentId, templateId, grade);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async updateFeedback(req, res, next) {
    try {
      const { id } = req.params;
      const { nuevoContenido } = req.body;
      const data = await this.feedbackService.editFeedback(id, nuevoContenido);
      res.json({ exito: true, mensaje: 'Feedback editado', data });
    } catch (error) {
      next(error);
    }
  }

  async approveAndSend(req, res, next) {
    try {
      const result = await this.feedbackService.approveAndSend(req.body, req.ltiContext);
      res.json({ exito: true, mensaje: 'Feedback aprobado y enviado a Canvas SpeedGrader. Notificación enviada.', data: result });
    } catch (error) {
      next(error);
    }
  }

  async rateByStudent(req, res, next) {
    try {
      const { id, rating } = req.body;
      await this.feedbackService.rateByStudent(id, rating, req.ltiContext);
      res.json({ exito: true, mensaje: 'Calificación guardada' });
    } catch (error) {
      next(error);
    }
  }

  async getStudentView(req, res, next) {
    try {
      const { studentId } = req.params;
      
      // IDOR prevention (RF26)
      // Se verifica tanto el rol local (modo dev) como los URNs LTI reales.
      const roles = req.ltiContext?.role || [];
      const roleList = Array.isArray(roles) ? roles : [roles];
      const isStudentRole = req.ltiContext?.localRole === 'student'
        || roleList.some(r => typeof r === 'string' && r.toLowerCase().includes('learner'));

      if (isStudentRole && String(req.ltiContext?.user) !== String(studentId)) {
        const { AppError } = await import('../utils/errors.js');
        throw new AppError('Acceso prohibido al feedback de otro estudiante', 403);
      }

      const courseId = req.query.courseId ? Number(req.query.courseId) : undefined;
      const data = await this.feedbackService.getStudentView(studentId, courseId);
      res.json({ exito: true, data });
    } catch (error) {
      next(error);
    }
  }
}
