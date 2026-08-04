import FeedbackGenerationService from './FeedbackGenerationService.js';
import FeedbackQueryService from './FeedbackQueryService.js';
import FeedbackMutationService from './FeedbackMutationService.js';
import logger from '../utils/logger.js';

import MassiveGenerationOrchestrator from './jobs/MassiveGenerationOrchestrator.js';

/**
 * FeedbackService - Facade de composición.
 *
 * Mantiene la interfaz pública original (inyectada en bootstrap.js) pero
 * delega en servicios especializados para cumplir SRP sin romper dependencias.
 */
export default class FeedbackService {
  constructor(canvasGateway, feedbackRepo, templateRepo, academicHistoryService, validadorAcademico, configRepo, iaConfigManager, preferencesService = null, emailService = null, systemNotificationService = null) {
    this.generation = new FeedbackGenerationService(
      canvasGateway, feedbackRepo, templateRepo,
      academicHistoryService, validadorAcademico, configRepo, iaConfigManager
    );
    this.query = new FeedbackQueryService(
      feedbackRepo, canvasGateway, academicHistoryService, validadorAcademico
    );
    this.mutation = new FeedbackMutationService(
      feedbackRepo,
      canvasGateway,
      preferencesService,
      emailService,
      systemNotificationService
    );
    this.orchestrator = new MassiveGenerationOrchestrator(this.generation);
    
    this.academicHistoryService = academicHistoryService;
    this.feedbackRepo = feedbackRepo;
    this.canvasGateway = canvasGateway;
  }

  // Orquestación
  generateFeedback(...args) {
    return this.generation.generateFeedback(...args);
  }

  generateMassive(courseId, activeAssignments, students, teacherId, isRegenerate = false) {
    this.orchestrator.execute(courseId, activeAssignments, students, teacherId, isRegenerate);
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

  rateByStudent(feedbackId, rating, esUtil, ltiContext = null) {
    return this.mutation.rateByStudent(feedbackId, rating, esUtil, ltiContext);
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