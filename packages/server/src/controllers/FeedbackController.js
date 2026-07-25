import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/errors.js';

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
    this.listPending = asyncHandler(this.listPending.bind(this));
    this.listAll = asyncHandler(this.listAll.bind(this));
    this.getDetail = asyncHandler(this.getDetail.bind(this));
    this.generate = asyncHandler(this.generate.bind(this));
    this.updateFeedback = asyncHandler(this.updateFeedback.bind(this));
    this.approveAndSend = asyncHandler(this.approveAndSend.bind(this));
    this.rateByStudent = asyncHandler(this.rateByStudent.bind(this));
    this.getStudentView = asyncHandler(this.getStudentView.bind(this));
  }

  async listPending(req, res) {
    const data = await this.feedbackService.getStats();
    res.json({ exito: true, data });
  }

  async listAll(req, res) {
    const data = await this.feedbackService.getListAll();
    res.json({ exito: true, data });
  }

  async getDetail(req, res) {
    const { studentId, courseId } = req.query;

    // IDOR prevention
    const roles = req.ltiContext?.role || [];
    const roleList = Array.isArray(roles) ? roles : [roles];
    const isStudentRole = req.ltiContext?.localRole === 'student'
      || roleList.some(r => typeof r === 'string' && r.toLowerCase().includes('learner'));

    if (isStudentRole && String(req.ltiContext?.studentId ?? req.ltiContext?.user) !== String(studentId)) {
      throw new ApiError('Acceso prohibido al detalle del feedback de otro estudiante', 403);
    }

    const data = await this.feedbackService.findByStudent(studentId, courseId);
    res.json({ exito: true, data });
  }

  async generate(req, res) {
    const { courseId, assignmentId, studentId, templateId, grade } = req.body;

    if (grade !== undefined && grade !== null) {
      const numGrade = Number(grade);
      if (Number.isNaN(numGrade) || numGrade < 0 || numGrade > 100) {
        throw new ApiError('La calificación debe ser un número entre 0 y 100', 400);
      }
    }
    const teacherId = req.ltiContext?.user || req.user?.id || 'system';
    const result = await this.feedbackService.generateFeedback(courseId, assignmentId, studentId, templateId, grade, teacherId);
    res.json(result);
  }

  async updateFeedback(req, res) {
    const { id } = req.params;
    const { nuevoContenido } = req.body;
    const data = await this.feedbackService.editFeedback(id, nuevoContenido);
    res.json({ exito: true, mensaje: 'Feedback editado', data });
  }

  async approveAndSend(req, res) {
    const result = await this.feedbackService.approveAndSend(req.body, req.ltiContext);
    res.json({ exito: true, mensaje: 'Feedback aprobado y enviado a Canvas SpeedGrader. Notificación enviada.', data: result });
  }

  async rateByStudent(req, res) {
    const { id, rating } = req.body;
    await this.feedbackService.rateByStudent(id, rating, req.ltiContext);
    res.json({ exito: true, mensaje: 'Calificación guardada' });
  }

  async getStudentView(req, res) {
    const { studentId } = req.params;
    
    // IDOR prevention (RF26)
    // Se verifica tanto el rol local (modo dev) como los URNs LTI reales.
    const roles = req.ltiContext?.role || [];
    const roleList = Array.isArray(roles) ? roles : [roles];
    const isStudentRole = req.ltiContext?.localRole === 'student'
      || roleList.some(r => typeof r === 'string' && r.toLowerCase().includes('learner'));

    if (isStudentRole && String(req.ltiContext?.studentId ?? req.ltiContext?.user) !== String(studentId)) {
      throw new ApiError('Acceso prohibido al feedback de otro estudiante', 403);
    }

    const courseId = req.query.courseId ? Number(req.query.courseId) : undefined;
    const data = await this.feedbackService.getStudentView(studentId, courseId);
    res.json({ exito: true, data });
  }
}
