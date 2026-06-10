import PromptManager from './PromptManager.js';
import GradeConverter from './calificaciones/GradeConverter.js';
import { AppError } from '../middlewares/ErrorHandler.js';

/**
 * Servicio de Orquestación de Feedback
 *
 * Flujo:
 *  1. Canvas: entrega, preguntas (con is_correct), rúbrica, estudiantes
 *  2. Nombre de la actividad desde Canvas
 *  3. Conversión de nota Canvas (0–100) → nota chilena (1.0–7.0)
 *  4. Inteligencia académica: historial + perfil del estudiante
 *  5. Plantilla + selección de tono según nota chilena
 *  6. Construcción del prompt con detalle de preguntas (correctas/incorrectas)
 *  7. Llamada a Gemini
 *  8. Persistencia en BD
 */
export default class FeedbackService {
  constructor(iaProvider, canvasService, feedbackRepo, templateRepo, academicHistoryService, validadorAcademico, configRepo) {
    this.iaProvider = iaProvider;
    this.canvasService = canvasService;
    this.feedbackRepo = feedbackRepo;
    this.templateRepo = templateRepo;
    this.academicHistoryService = academicHistoryService;
    this.validadorAcademico = validadorAcademico;
    this.configRepo = configRepo;
  }

  /**
   * Orquesta el flujo completo
   * @param {number} courseId
   * @param {number} assignmentId
   * @param {number} studentId
   * @param {number} templateId
   * @param {number} currentGrade - Nota ingresada en el SpeedGrader (escala 0–10)
   */
  async generateFeedback(courseId, assignmentId, studentId, templateId, currentGrade) {
    try {
      console.log(`[ORQUESTADOR] Generando para Estudiante:${studentId} (Nota ingresada: ${currentGrade})`);

      // ── 1. Datos de Canvas ──────────────────────────────────────────────
      const submission   = await this.canvasService.getSubmission(courseId, assignmentId, studentId);
      const questions    = await this.canvasService.getQuizQuestions(courseId, assignmentId);
      const rubric       = await this.canvasService.getRubric(courseId, assignmentId);
      const students     = await this.canvasService.getStudents(courseId);
      const student      = students.find(s => s.id === studentId) || { name: 'Estudiante' };

      // ── 2. Nombre de la actividad ──────────────────────────────────────
      const assignment =
        (this.canvasService.getAssignment && (await this.canvasService.getAssignment(courseId, assignmentId)))
        || (await this.canvasService.getAssignments(courseId)).then(list => list.find(a => a.id === assignmentId))
        || { name: `Tarea ${assignmentId}` };
      const assignmentName = assignment.name || `Tarea ${assignmentId}`;

      // ── 3. Conversión de nota ───────────────────────────────────────────
      const rawCanvasScore = typeof currentGrade === 'number' && currentGrade > 10
        ? currentGrade
        : (currentGrade / 10) * (submission.points_possible || 100);

      const { chileGrade, approved } = GradeConverter.toChileGrade(
        rawCanvasScore,
        submission.points_possible || (questions.length * 10) || 100
      );
      const canvasScore = Math.round(rawCanvasScore);

      console.log(`[ORQUESTADOR] Canvas ${canvasScore}/100 → Chile ${chileGrade}/7.0 ${approved ? '✓ Aprobado' : '✗ Reprobado'}`);

      // ── 4. Inteligencia académica ───────────────────────────────────────
      const history = await this.academicHistoryService.getStudentAcademicProfile(courseId, studentId);
      const profile = this.validadorAcademico.generateStudentProfile(history);

      // ── 5. Plantilla ───────────────────────────────────────────────────
      const template = await this.templateRepo.getById(templateId);
      if (!template) throw new AppError('Plantilla no encontrada', 404);

      // ── 6. Detalle de preguntas ─────────────────────────────────────────
      // getQuizQuestions devuelve preguntas en crudo (sin is_correct).
      // getSubmission() devuelve submission.questions ya computadas con is_correct.
      const questionSet = submission.questions || questions;
      const questionsDetail = questionSet.length > 0
        ? questionSet.map(q => {
            const status = q.is_correct
              ? '✅ CORRECTA'
              : `❌ INCORRECTA (respondió "${q.student_answer ?? 'Sin respuesta'}", correcta: "${q.correct_answer}")`;
            return `  [${q.id}] ${q.text}\n    Opciones: ${Object.entries(q.options).map(([k, v]) => `${k}) ${v}`).join(' | ')}\n    ${status}`;
          }).join('\n\n')
        : null;

      // ── 6.5 Variables de Personalización (BD) ───────────────────────────
      let activeVariablesText = "";
      if (this.configRepo) {
        const configAsignacion = await this.configRepo.getConfigAsignacion(courseId, assignmentId);
        if (configAsignacion && configAsignacion.variables) {
          const activeVars = configAsignacion.variables.filter(v => v.variable_activa);
          if (activeVars.length > 0) {
            activeVariablesText = "\\nAdicionalmente, ten en cuenta las siguientes variables de personalización solicitadas por el profesor:\\n";
            activeVars.forEach(v => {
               activeVariablesText += `- ${v.variable_id} (Relevancia: ${v.ponderacion}%)\\n`;
            });
          }
        }
      }

      // ── 7. Construir Contexto ───────────────────────────────────────────
      const correctCount   = submission.correct_count   ?? questionSet.filter(q => q.is_correct).length;
      const incorrectCount = submission.incorrect_count ?? (questionSet.length - correctCount);
      const accuracyPct    = submission.accuracy_percent ?? Math.round((correctCount / questionSet.length) * 100);

      const context = {
        student: { id: studentId, name: student.name },
        assignment: { id: assignmentId, name: assignmentName },
        course:    { id: courseId },
        submission: {
          body:             submission.body,
          score:            chileGrade,
          canvasScore,
          chileGrade,
          pointsPossible:   submission.points_possible || 100,
          submittedAt:      submission.submitted_at,
          questionsDetail,
          correctCount,
          incorrectCount,
          accuracyPercent:  accuracyPct
        },
        rubric,
        profile,
        instructionIA: `El estudiante tiene un nivel ${profile.level} y tendencia ${profile.trend}. ` +
          `La calificación Canvas es ${canvasScore}/100, que equivale a ${chileGrade}/7.0 en la escala chilena (aprobado: ${approved}).` +
          activeVariablesText
      };

      const prompt = PromptManager.buildPrompt(template.contenido, context);

      // ── 8. Llamada a Gemini ─────────────────────────────────────────────
      const feedbackText = await this.iaProvider.generateFeedback(prompt);

      // ── 9. Persistencia ─────────────────────────────────────────────────
      const saved = await this.feedbackRepo.save({
        cursoId:        courseId,
        tareaId:        assignmentId,
        estudianteId:   studentId,
        plantillaId:    templateId,
        contenidoGenerado: feedbackText,
        promptUsado:    prompt,
        notaCanvas:     canvasScore,
        notaChile:      chileGrade,
        aprobado:       approved
      });

      return {
        exito: true,
        data: {
          id:              saved.id,
          content:         saved.contenido_generado || saved.contenido || saved.contenidoGenerado || feedbackText,
          promptUsed:      prompt,
          canvasScore,
          chileGrade,
          approved,
          questionsDetail,
          studentName:     student.name,
          assignmentName:  assignmentName,
          profile:         { level: profile.level, trend: profile.trend, average: profile.average }
        }
      };
    } catch (error) {
      console.error('[ORQUESTADOR] Error:', error.message);
      throw error;
    }
  }
}
