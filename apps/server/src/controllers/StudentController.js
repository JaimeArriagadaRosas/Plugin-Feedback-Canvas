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
    
    // Aquí el req.user o ltiContext será del propio estudiante
    const currentUserId = req.ltiContext?.user || req.user?.canvas_user_uuid || req.user?.canvas_user_id || req.user?.id || 'system';
    
    // Se delega al servicio
    const data = await this.feedbackService.getStudentView(studentId, courseId, currentUserId);
    res.json({ exito: true, data });
  }

  async rateByStudent(req, res) {
    const { id, rating } = req.body;
    
    // El servicio deberá usar el ltiContext para saber que es el estudiante calificando
    await this.feedbackService.rateByStudent(id, rating, req.ltiContext);
    res.json({ exito: true, mensaje: 'Calificación de utilidad guardada correctamente' });
  }
}
