import FeedbackGenerationService from './FeedbackGenerationService.js';
import FeedbackQueryService from './FeedbackQueryService.js';
import { AppError } from '../utils/errors.js';
import logger from '../utils/logger.js';

/**
 * FeedbackService - Facade de composición.
 *
 * Mantiene la interfaz pública original (inyectada en bootstrap.js) pero
 * delega en servicios especializados para cumplir SRP sin romper dependencias.
 */
export default class FeedbackService {
  constructor(iaProvider, canvasService, feedbackRepo, templateRepo, academicHistoryService, validadorAcademico, configRepo) {
    this.generation = new FeedbackGenerationService(
      iaProvider, canvasService, feedbackRepo, templateRepo,
      academicHistoryService, validadorAcademico, configRepo
    );
    this.query = new FeedbackQueryService(
      feedbackRepo, canvasService, academicHistoryService, validadorAcademico
    );
  }

  // Orquestación
  generateFeedback(...args) {
    return this.generation.generateFeedback(...args);
  }

  // Consultas
  getStats(...args) {
    return this.query.getStats(...args);
  }

  getListAll(...args) {
    return this.query.getListAll(...args);
  }

  findByStudent(...args) {
    return this.query.findByStudent(...args);
  }

  editFeedback(id, nuevoContenido) {
    return this.generation.feedbackRepo.updateStatusAndContent(id, 'EDITADO', nuevoContenido);
  }

  rateByStudent(feedbackId, rating, ltiContext = null) {
    return this.query.rateByStudent(feedbackId, rating, ltiContext);
  }

  getStudentView(...args) {
    return this.query.getStudentView(...args);
  }

  // Operaciones de envío (se quedan aquí por acoplamiento con Canvas)
  async approveAndSend({ feedbackId, courseId, assignmentId, studentId, content, rating, grade }, ltiContext = null) {
    // BOLA prevention (OWASP API1:2023): el feedback debe pertenecer al estudiante/curso
    // indicados y, si hay contexto autenticado de estudiante, coincidir con él.
    if (feedbackId) {
      const existing = await this.generation.feedbackRepo.getById(feedbackId);
      if (!existing) {
        throw new AppError('Feedback no encontrado', 404);
      }
      if (studentId != null && String(existing.estudiante_id) !== String(studentId)) {
        throw new AppError('Acceso denegado: el feedback no pertenece al estudiante indicado.', 403);
      }
      if (courseId != null && String(existing.curso_id) !== String(courseId)) {
        throw new AppError('Acceso denegado: el feedback no pertenece al curso indicado.', 403);
      }
      if (ltiContext?.studentId != null && String(existing.estudiante_id) !== String(ltiContext.studentId)) {
        throw new AppError('Acceso denegado: no puedes aprobar el feedback de otro estudiante.', 403);
      }
      await this.generation.feedbackRepo.updateStatusAndContent(feedbackId, 'APROBADO', content);
      if (rating) {
        await this.generation.feedbackRepo.updateProfesorRating(feedbackId, rating);
      }
    }

    try {
      await this.generation.canvasService.postComment(courseId, assignmentId, studentId, content);

      if (grade) {
        await this.generation.canvasService.updateGrade(courseId, assignmentId, studentId, grade);
      }
    } catch (canvasError) {
      // Si falla Canvas, revertir el estado en BD para mantener consistencia.
      // El feedback vuelve a EDITADO para que el profesor pueda reintentar.
      if (feedbackId) {
        await this.generation.feedbackRepo.updateStatusAndContent(feedbackId, 'EDITADO', content).catch(e => {
          logger.error('[FeedbackService] Error Crítico: Fallo al revertir estado del feedback tras error en Canvas', { feedbackId, error: e.message });
        });
      }
      throw canvasError;
    }

    if (feedbackId) {
      await this.generation.feedbackRepo.saveNotification(
        studentId,
        feedbackId,
        `Tienes un nuevo feedback aprobado en el curso ${courseId}`
      );
    }

    return { feedbackId, studentId };
  }

  // RF62: Feedback manual
  async submitManualFeedback({ courseId, assignmentId, studentId, contenidoManual, grade }) {
    if (!contenidoManual) {
      const { AppError } = await import('../utils/errors.js');
      throw new AppError('El contenido manual es requerido', 400);
    }

    const fbGuardado = await this.generation.feedbackRepo.save({
      estudianteId: studentId,
      cursoId: courseId,
      tareaId: assignmentId,
      plantillaId: null,
      contenidoGenerado: contenidoManual,
      promptUsado: 'MODO MANUAL - SIN IA (RF62)',
      notaCanvas: grade || null,
      notaChile: null,
      aprobado: true
    });

    await this.generation.feedbackRepo.updateStatusAndContent(fbGuardado.id, 'ENVIADO', contenidoManual);
    
    try {
      await this.generation.canvasService.postComment(courseId, assignmentId, studentId, contenidoManual);

      if (grade) {
        await this.generation.canvasService.updateGrade(courseId, assignmentId, studentId, grade);
      }
    } catch (canvasError) {
      await this.generation.feedbackRepo.updateStatusAndContent(fbGuardado.id, 'PENDIENTE', contenidoManual).catch(e => {
        logger.error('[FeedbackService] Error Crítico: Fallo al revertir estado del feedback manual tras error en Canvas', { feedbackId: fbGuardado.id, error: e.message });
      });
      throw canvasError;
    }

    return fbGuardado;
  }
}