import PromptManager from './PromptManager.js';
import GradeConverter from './calificaciones/GradeConverter.js';
import { DomainError } from '../domain/errors/DomainError.js';

/**
 * FeedbackGenerationService - Responsabilidad única: orquestar generación de feedback.
 *
 * Separtado de FeedbackService para cumplir SRP. Usa dependency injection.
 */
export default class FeedbackGenerationService {
  constructor(iaProvider, canvasGateway, feedbackRepo, templateRepo, academicHistoryService, validadorAcademico, configRepo, iaConfigManager) {
    this.iaProvider = iaProvider;
    this.canvasGateway = canvasGateway;
    this.feedbackRepo = feedbackRepo;
    this.templateRepo = templateRepo;
    this.academicHistoryService = academicHistoryService;
    this.validadorAcademico = validadorAcademico;
    this.configRepo = configRepo;
    this.iaConfigManager = iaConfigManager;
  }

  async generateFeedback(courseId, assignmentId, studentId, templateId, currentGrade, teacherId) {
    try {
      const canvasData = await this._fetchCanvasData(courseId, assignmentId, studentId, teacherId);
      const { assignment, assignmentName, student, questions, rubric } = canvasData;

      const { chileGrade, approved, canvasScore } = this._convertGrade(currentGrade, canvasData.submission);

      const profile = await this._buildProfile(courseId, studentId);

      const { questionsDetail, context } = this._buildContext(
        studentId,
        assignmentId,
        assignmentName,
        canvasData.submission,
        questions,
        rubric,
        profile,
        chileGrade,
        approved,
        canvasScore
      );

      const template = await this.templateRepo.getById(templateId);
      if (!template) throw new DomainError('Plantilla no encontrada', 404);

      const activeVariablesText = await this._getActiveVariablesText(courseId, assignmentId);

      const prompt = PromptManager.buildPrompt(template.contenido, { ...context, instructionIA: context.instructionIA + activeVariablesText });

      let aiConfig = {};
      if (this.iaConfigManager) {
        try {
          aiConfig = await this.iaConfigManager.getActiveConfig('gemini');
        } catch (e) {
          // Si no hay configuración activa, se usará el fallback local o el key base del provider
        }
      }

      const feedbackText = await this.iaProvider.generateFeedback(prompt, {
        apiKey: aiConfig.apiKey,
        model: aiConfig.model,
        maxOutputTokens: aiConfig.maxTokens
      });

      const saved = await this.feedbackRepo.save({
        cursoId: courseId,
        tareaId: assignmentId,
        estudianteId: studentId,
        profesorId: teacherId,
        plantillaId: templateId,
        contenidoGenerado: feedbackText,
        promptUsado: prompt,
        notaCanvas: canvasScore,
        notaChile: chileGrade,
        aprobado: approved
      });

      return {
        exito: true,
        data: {
          id: saved.id,
          content: saved.contenido_generado || saved.contenido || saved.contenidoGenerado || feedbackText,
          promptUsed: prompt,
          canvasScore,
          chileGrade,
          approved,
          questionsDetail,
          studentName: student.name,
          assignmentName,
          profile: { level: profile.level, trend: profile.trend, average: profile.average }
        }
      };
    } catch (error) {
      throw error;
    }
  }

  async _fetchCanvasData(courseId, assignmentId, studentId, teacherId) {
    const [submission, questions, rubric, students] = await Promise.all([
      this.canvasGateway.getSubmission(courseId, assignmentId, studentId, teacherId),
      this.canvasGateway.getQuizQuestions(courseId, assignmentId, teacherId),
      this.canvasGateway.getRubric(courseId, assignmentId, teacherId),
      this.canvasGateway.getStudents(courseId, teacherId)
    ]);

    const student = students.find(s => s.id === studentId) || { name: 'Estudiante' };
    const assignment = (this.canvasGateway.getAssignment && (await this.canvasGateway.getAssignment(courseId, assignmentId, teacherId)))
      || (await this.canvasGateway.getAssignments(courseId, teacherId)).find(a => a.id === assignmentId)
      || { name: `Tarea ${assignmentId}` };

    return { submission, questions, rubric, students, student, assignment };
  }

  _convertGrade(currentGrade, submission) {
    const pointsPossibleRaw = submission?.points_possible;
    const pointsPossible = typeof pointsPossibleRaw === 'number' && Number.isFinite(pointsPossibleRaw)
      ? pointsPossibleRaw
      : 100;

    if (pointsPossible <= 0) {
      throw new DomainError('points_possible debe ser mayor a 0', 422);
    }

    let rawCanvasScore;
    if (typeof currentGrade === 'number' && Number.isFinite(currentGrade) && currentGrade <= 7 && pointsPossible > 10) {
      if (currentGrade < 1.0 || currentGrade > 7.0) {
        throw new DomainError('Nota chilena fuera de rango (1.0–7.0)', 422);
      }
      if (currentGrade >= 4.0) {
        rawCanvasScore = 60 + ((currentGrade - 4.0) / 3.0) * 40;
      } else {
        rawCanvasScore = ((currentGrade - 1.0) / 2.9) * 60;
      }
    } else {
      rawCanvasScore = typeof currentGrade === 'number' ? currentGrade : parseFloat(currentGrade);
      if (!Number.isFinite(rawCanvasScore) || rawCanvasScore < 0 || rawCanvasScore > pointsPossible) {
        throw new DomainError(`Calificación Canvas fuera de rango (0–${pointsPossible})`, 422);
      }
    }

    const { chileGrade, approved } = GradeConverter.toChileGrade(rawCanvasScore, pointsPossible);
    const canvasScore = Math.round(rawCanvasScore);
    return { chileGrade, approved, canvasScore };
  }

  async _buildProfile(courseId, studentId) {
    const history = await this.academicHistoryService.getStudentAcademicProfile(courseId, studentId);
    return this.validadorAcademico.generateStudentProfile(history);
  }

  _buildContext(studentId, assignmentId, assignmentName, submission, questions, rubric, profile, chileGrade, approved, canvasScore) {
    const questionSet = submission.questions || questions;
    const questionsDetail = questionSet.length > 0
      ? questionSet.map(q => {
          const status = q.is_correct
            ? '✅ CORRECTA'
            : `❌ INCORRECTA (respondió "${q.student_answer ?? 'Sin respuesta'}", correcta: "${q.correct_answer}")`;
          return `  [${q.id}] ${q.text}\n    Opciones: ${Object.entries(q.options).map(([k, v]) => `${k}) ${v}`).join(' | ')}\n    ${status}`;
        }).join('\n\n')
      : null;

    const correctCount = submission.correct_count ?? questionSet.filter(q => q.is_correct).length;
    const incorrectCount = submission.incorrect_count ?? (questionSet.length - correctCount);
    const accuracyPct = submission.accuracy_percent ??
      (questionSet.length > 0 ? Math.round((correctCount / questionSet.length) * 100) : null);

    const context = {
      student: { id: studentId },
      assignment: { id: assignmentId, name: assignmentName },
      course: { id: null },
      submission: {
        body: submission.body,
        score: chileGrade,
        canvasScore,
        chileGrade,
        pointsPossible: submission.points_possible || 100,
        submittedAt: submission.submitted_at,
        questionsDetail,
        correctCount,
        incorrectCount,
        accuracyPercent: accuracyPct
      },
      rubric,
      profile,
      instructionIA: `El estudiante tiene un nivel ${profile.level} y tendencia ${profile.trend}. ` +
        `La calificación Canvas es ${canvasScore}/100, que equivale a ${chileGrade}/7.0 en la escala chilena (aprobado: ${approved}). ` +
        `Genera la respuesta estrictamente en el idioma que solicite la plantilla o el profesor, si no se especifica, usa español.`
    };

    return { questionsDetail, context };
  }

  async _getActiveVariablesText(courseId, assignmentId) {
    let activeVariablesText = "";
    if (this.configRepo) {
      const configAsignacion = await this.configRepo.getConfigAsignacion(courseId, assignmentId);
      if (configAsignacion?.variables) {
        const activeVars = configAsignacion.variables.filter(v => v.variable_activa);
        if (activeVars.length > 0) {
          activeVariablesText = "\\nAdicionalmente, ten en cuenta las siguientes variables de personalización solicitadas por el profesor:\\n";
          activeVars.forEach(v => {
            activeVariablesText += `- ${v.variable_id} (Relevancia: ${v.ponderacion}%)\\n`;
          });
        }
      }
    }
    return activeVariablesText;
  }
}