import FeedbackGenerationService from './FeedbackGenerationService.js';
import FeedbackQueryService from './FeedbackQueryService.js';
import FeedbackMutationService from './FeedbackMutationService.js';
import { AppError } from '../utils/errors.js';
import logger from '../utils/logger.js';

/**
 * FeedbackService - Facade de composición.
 *
 * Mantiene la interfaz pública original (inyectada en bootstrap.js) pero
 * delega en servicios especializados para cumplir SRP sin romper dependencias.
 */
export default class FeedbackService {
  constructor(iaProvider, canvasGateway, feedbackRepo, templateRepo, academicHistoryService, validadorAcademico, configRepo, iaConfigManager, preferencesService = null, emailService = null) {
    this.generation = new FeedbackGenerationService(
      iaProvider, canvasGateway, feedbackRepo, templateRepo,
      academicHistoryService, validadorAcademico, configRepo, iaConfigManager
    );
    this.query = new FeedbackQueryService(
      feedbackRepo, canvasGateway, academicHistoryService, validadorAcademico
    );
    this.mutation = new FeedbackMutationService(
      feedbackRepo, canvasGateway, preferencesService, emailService
    );
    this.academicHistoryService = academicHistoryService;
    this.feedbackRepo = feedbackRepo;
    this.canvasGateway = canvasGateway;
  }

  // Orquestación
  generateFeedback(...args) {
    return this.generation.generateFeedback(...args);
  }

  generateMassive(courseId, activeAssignments, students, teacherId, isRegenerate = false) {
    setTimeout(async () => {
      for (const assignment of activeAssignments) {
        for (const student of students) {
          try {
             await this.generateFeedback(courseId, assignment.id, student.id, assignment.templateId || 1, undefined, teacherId, { isRegenerate });
          } catch (e) {
             logger.error(`[FeedbackService] Error en generación masiva para estudiante ${student.id} en tarea ${assignment.id}: ${e.message}`);
          }
        }
      }
    }, 0);
  }

  // Consultas
  getStats(...args) {
    return this.query.getStats(...args);
  }

  getListAll(courseId, teacherId) {
    return this.query.getListAll(courseId, teacherId);
  }

  getPendingSummary(courseId, teacherId) {
    return this.query.getPendingSummary(courseId, teacherId);
  }

  findByStudent(...args) {
    return this.query.findByStudent(...args);
  }

  editFeedback(id, nuevoContenido) {
    return this.mutation.editFeedback(id, nuevoContenido);
  }

  rateByStudent(feedbackId, rating, ltiContext = null) {
    return this.mutation.rateByStudent(feedbackId, rating, ltiContext);
  }

  getStudentView(studentId, courseId, teacherId) {
    return this.query.getStudentView(studentId, courseId, teacherId);
  }

  // Operaciones de envío delegadas
  approveAndSend(params, ltiContext = null, providedTeacherId = null) {
    return this.mutation.approveAndSend(params, ltiContext, providedTeacherId);
  }

  rateByTeacher(feedbackId, rating, teacherId) {
    return this.mutation.rateByTeacher(feedbackId, rating, teacherId);
  }

  submitManualFeedback(params) {
    return this.mutation.submitManualFeedback(params);
  }
}