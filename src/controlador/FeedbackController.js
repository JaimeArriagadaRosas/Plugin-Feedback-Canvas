import { AppError } from '../middlewares/ErrorHandler.js';

/**
 * Controlador de Feedback (RF23, RF24, RF25, RF26, RF30, RF31)
 */
export default class FeedbackController {
  constructor(feedbackService, canvasService) {
    this.feedbackService = feedbackService;
    this.canvasService = canvasService;
  }

  async listPending(req, res, next) {
    try {
      const pending = await this.feedbackService.feedbackRepo.getStats();
      res.json({ exito: true, data: pending });
    } catch (error) {
      next(error);
    }
  }

  async getDetail(req, res, next) {
    try {
      const { studentId, courseId } = req.query;
      const history = await this.feedbackService.feedbackRepo.findByStudent(studentId, courseId);
      res.json({ exito: true, data: history });
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
      res.json({ exito: true, mensaje: 'Feedback editado', data: { id, nuevoContenido } });
    } catch (error) {
      next(error);
    }
  }

  async approveAndSend(req, res, next) {
    try {
      const { feedbackId, courseId, assignmentId, studentId, content } = req.body;
      await this.canvasService.postComment(courseId, assignmentId, studentId, content);
      res.json({ exito: true, mensaje: 'Feedback aprobado y enviado a Canvas SpeedGrader' });
    } catch (error) {
      next(error);
    }
  }

  async getStudentView(req, res, next) {
    try {
      const { studentId } = req.params;
      res.json({ exito: true, data: { status: 'Recibido', text: 'Excelente trabajo...' } });
    } catch (error) {
      next(error);
    }
  }
}
