import { asyncHandler } from '../utils/asyncHandler.js';
import { assertOwnStudent } from '../authz/requireOwnStudent.js';

/**
 * Student Controller (RF31, RF32, RF33)
 *
 * Exclusively handles requests made by students
 * on their own feedback and ratings (SRP).
 */
export default class StudentController {
  constructor(feedbackService) {
    this.feedbackService = feedbackService;
    this.getStudentView = asyncHandler(this.getStudentView.bind(this));
    this.rateByStudent = asyncHandler(this.rateByStudent.bind(this));
  }

  async getStudentView(req, res) {
    const { studentId } = req.params;
    
    // IDOR prevention
    assertOwnStudent(req, studentId);

    const courseId = req.query.courseId ? String(req.query.courseId) : undefined;
    
    // Here req.appIdentity will be of the student themselves
    const currentUserId = req.appIdentity?.canonicalUserId || 'system';

    // Delegated to the service
    const data = await this.feedbackService.getStudentView(studentId, courseId, currentUserId);
    res.json({ exito: true, data });
  }

  async rateByStudent(req, res) {
    const { id, rating, esUtil } = req.body;
    
    // The service must use appIdentity to know it is the student rating
    await this.feedbackService.rateByStudent(id, rating, esUtil, req.appIdentity);
    res.json({ exito: true, mensaje: 'Utility rating saved successfully' });
  }
}
