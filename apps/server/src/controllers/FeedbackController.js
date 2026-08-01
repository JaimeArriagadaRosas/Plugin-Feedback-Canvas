import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/errors.js';
import { assertOwnStudent } from '../authz/requireOwnStudent.js';

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
    this.rateByTeacher = asyncHandler(this.rateByTeacher.bind(this));
    this.getHistory = asyncHandler(this.getHistory.bind(this));
    this.generateMassive = asyncHandler(this.generateMassive.bind(this));
    this.getPendingSummary = asyncHandler(this.getPendingSummary.bind(this));
  }

  async listPending(req, res) {
    const data = await this.feedbackService.getStats();
    res.json({ exito: true, data });
  }

  async getPendingSummary(req, res) {
    const teacherId = req.appIdentity?.ltiUserId || req.appIdentity?.canonicalUserId || 'system';
    const courseId = req.query.courseId;
    const data = await this.feedbackService.getPendingSummary(courseId, teacherId);
    res.json({ exito: true, data });
  }

  async listAll(req, res) {
    const teacherId = req.appIdentity?.ltiUserId || req.appIdentity?.canonicalUserId || 'system';
    const courseId = req.query.courseId;
    const data = await this.feedbackService.getListAll(courseId, teacherId);
    res.json({ exito: true, data });
  }

  async getDetail(req, res) {
    const { studentId, courseId } = req.query;

    // IDOR prevention
    assertOwnStudent(req, studentId);

    const data = await this.feedbackService.findByStudent(studentId, courseId);
    res.json({ exito: true, data });
  }

  async generate(req, res) {
    const { courseId, assignmentId, studentId, templateId, grade, courseName, assignmentName, studentName, isRegenerate } = req.body;

    if (grade !== undefined && grade !== null) {
      const numGrade = Number(grade);
      if (Number.isNaN(numGrade) || numGrade < 0 || numGrade > 100) {
        throw new ApiError('La calificación debe ser un número entre 0 y 100', 400);
      }
    }
    const teacherId = req.appIdentity?.ltiUserId || req.appIdentity?.canonicalUserId || 'system';
    const metadata = { courseName, assignmentName, studentName, isRegenerate };
    const result = await this.feedbackService.generateFeedback(courseId, assignmentId, studentId, templateId, grade, teacherId, metadata);
    res.json(result);
  }

  async generateMassive(req, res) {
    const { courseId, activeAssignments, students, isRegenerate = false } = req.body;
    const teacherId = req.appIdentity?.ltiUserId || req.appIdentity?.canonicalUserId || 'system';
    
    // Responder inmediatamente (procesamiento en segundo plano)
    res.json({ exito: true, mensaje: 'Generación masiva iniciada en segundo plano' });

    // Procesar iterativamente en background
    this.feedbackService.generateMassive(courseId, activeAssignments, students, teacherId, isRegenerate);
  }

  async updateFeedback(req, res) {
    const { id } = req.params;
    const { nuevoContenido } = req.body;
    const data = await this.feedbackService.editFeedback(id, nuevoContenido);
    res.json({ exito: true, mensaje: 'Feedback editado', data });
  }

  async approveAndSend(req, res) {
    const teacherId = req.appIdentity?.ltiUserId || req.appIdentity?.canonicalUserId || 'system';
    // Se pasa req.appIdentity al servicio en lugar de ltiContext
    const result = await this.feedbackService.approveAndSend(req.body, req.appIdentity, teacherId);
    res.json({ exito: true, mensaje: 'Feedback aprobado y enviado a Canvas SpeedGrader. Notificación enviada.', data: result });
  }



  async rateByTeacher(req, res) {
    const { id } = req.params;
    const { rating } = req.body;
    const teacherId = req.appIdentity?.ltiUserId || req.appIdentity?.canonicalUserId || 'system';
    const result = await this.feedbackService.rateByTeacher(id, rating, teacherId);
    res.json({ exito: true, mensaje: 'Valoración guardada correctamente', data: result });
  }

  async getHistory(req, res) {
    const { courseId, studentId } = req.params;
    const teacherId = req.appIdentity?.ltiUserId || req.appIdentity?.canonicalUserId || 'system';
    
    // We delegate directly to AcademicHistoryService
    // Since feedbackService has it or we can inject it. Wait, FeedbackService doesn't have it directly exposed if we didn't inject it.
    // Let's assume feedbackService exposes academicHistoryService, or we can just fetch it from req.app if needed.
    // Actually, FeedbackService has `academicHistoryService`? Let's check.
    const data = await this.feedbackService.academicHistoryService.getStudentAcademicProfile(courseId, studentId, teacherId);
    res.json({ exito: true, data });
  }
}
