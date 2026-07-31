import { asyncHandler } from '../utils/asyncHandler.js';
import { assertOwnStudent } from '../authz/requireOwnStudent.js';

/**
 * Controlador de Estudiante (RF31, RF32, RF33)
 *
 * Maneja exclusivamente las peticiones que realizan los estudiantes
 * sobre su propio feedback y valoraciones (SRP).
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
    
    // Aquí el req.appIdentity será del propio estudiante
    const currentUserId = req.appIdentity?.canonicalUserId || 'system';

    console.log('[DIAG-E2E] StudentController.getStudentView', {
      paramStudentId: studentId,
      queryCourseId: courseId,
      canonicalUserId: currentUserId
    });
    
    // Se delega al servicio
    const data = await this.feedbackService.getStudentView(studentId, courseId, currentUserId);
    res.json({ exito: true, data });
  }

  async rateByStudent(req, res) {
    const { id, rating } = req.body;
    
    // El servicio deberá usar el appIdentity para saber que es el estudiante calificando
    await this.feedbackService.rateByStudent(id, rating, req.appIdentity);
    res.json({ exito: true, mensaje: 'Calificación de utilidad guardada correctamente' });
  }
}
