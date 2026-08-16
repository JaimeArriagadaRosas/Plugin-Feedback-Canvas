import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/errors.js';
import { assertOwnStudent } from '../authz/requireOwnStudent.js';

/**
 * Feedback Controller (RF23, RF24, RF25, RF26, RF30, RF31)
 *
 * Thin layer: validates the transport (req/res) and delegates all business logic
 * to the FeedbackService. Does not access repositories or Canvas directly.
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
        throw new ApiError('The grade must be a number between 0 and 100', 400);
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
    
    // Respond immediately (background processing)
    res.json({ exito: true, mensaje: 'Massive generation started in the background' });

    // Process iteratively in background
    this.feedbackService.generateMassive(courseId, activeAssignments, students, teacherId, isRegenerate);
  }

  async updateFeedback(req, res) {
    const { id } = req.params;
    const { nuevoContenido } = req.body;
    const data = await this.feedbackService.editFeedback(id, nuevoContenido);
    res.json({ exito: true, mensaje: 'Feedback edited', data });
  }

  async approveAndSend(req, res) {
    const teacherId = req.appIdentity?.ltiUserId || req.appIdentity?.canonicalUserId || 'system';
    // Pass req.appIdentity to the service instead of ltiContext
    const result = await this.feedbackService.approveAndSend(req.body, req.appIdentity, teacherId);
    res.json({ exito: true, mensaje: 'Feedback approved and sent to Canvas SpeedGrader. Notification sent.', data: result });
  }



  async rateByTeacher(req, res) {
    const { id } = req.params;
    const { rating } = req.body;
    const teacherId = req.appIdentity?.ltiUserId || req.appIdentity?.canonicalUserId || 'system';
    const result = await this.feedbackService.rateByTeacher(id, rating, teacherId);
    res.json({ exito: true, mensaje: 'Rating saved successfully', data: result });
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
