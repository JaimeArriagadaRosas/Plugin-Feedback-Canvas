import PromptManager from './PromptManager.js';
import { AppError } from '../middlewares/ErrorHandler.js';

/**
 * Servicio de Orquestación de Feedback (Capa de Orquestación Mejorada)
 */
export default class FeedbackService {
  constructor(iaProvider, canvasService, feedbackRepo, templateRepo, academicHistoryService, validadorAcademico) {
    this.iaProvider = iaProvider;
    this.canvasService = canvasService;
    this.feedbackRepo = feedbackRepo;
    this.templateRepo = templateRepo;
    this.academicHistoryService = academicHistoryService;
    this.validadorAcademico = validadorAcademico;
  }

  /**
   * Orquesta el flujo completo integrando notas, historial y perfiles académicos.
   */
  async generateFeedback(courseId, assignmentId, studentId, templateId, currentGrade) {
    try {
      console.log(`[ORQUESTADOR] Generando para Estudiante:${studentId} (Nota: ${currentGrade})`);

      // 1. Obtener datos de Canvas (Entrega y Rúbrica)
      const submission = await this.canvasService.getSubmission(courseId, assignmentId, studentId);
      const rubric = await this.canvasService.getRubric(courseId, assignmentId);
      const students = await this.canvasService.getStudents(courseId);
      const student = students.find(s => s.id === studentId) || { name: 'Estudiante' };

      // 2. Obtener Inteligencia Académica (Historial y Perfil)
      const history = await this.academicHistoryService.getStudentAcademicProfile(courseId, studentId);
      const profile = this.validadorAcademico.generateStudentProfile(history);

      // 3. Obtener Plantilla
      const template = await this.templateRepo.getById(templateId);
      if (!template) throw new AppError('Plantilla no encontrada', 404);

      // 4. Construir Contexto para el Prompt
      const context = {
        student: { id: studentId, name: student.name },
        submission: { body: submission.body, score: currentGrade },
        rubric,
        profile, // { average, level, trend }
        instructionIA: `El estudiante tiene un nivel ${profile.level} y tendencia ${profile.trend}.`
      };

      const prompt = PromptManager.buildPrompt(template.content, context);

      // 5. Invocación a Gemini/IA
      const feedbackText = await this.iaProvider.generateFeedback(prompt);

      // 6. Persistir
      const saved = await this.feedbackRepo.save({
        courseId,
        assignmentId,
        studentId,
        templateId,
        content: feedbackText,
        promptUsed: prompt
      });

      return {
        exito: true,
        data: saved
      };
    } catch (error) {
      console.error('[ORQUESTADOR] Error:', error.message);
      throw error;
    }
  }
}
