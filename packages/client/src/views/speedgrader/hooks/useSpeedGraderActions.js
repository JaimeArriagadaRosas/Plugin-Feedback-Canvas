import { useCallback } from 'react';
import { api } from 'shared/api';
import logger from '../../../utils/logger';

export function useSpeedGraderActions({
  courseId,
  currentAssignmentId,
  currentStudent,
  students = [],
  grade,
  feedback,
  generatedFeedbackId,
  setLoading,
  setStatusMsg,
  setFeedback,
  setGeneratedFeedbackId,
  onExit,
  logExit
}) {
  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setStatusMsg("Conectando con el motor de IA...");
    try {
      const results = [];
      for (let i = 0; i < students.length; i++) {
        const student = students[i];
        setStatusMsg(`Generando feedback para todos los estudiantes... (${i + 1}/${students.length})`);
        const result = await api.post('/feedback/generate', {
          courseId: courseId,
          assignmentId: currentAssignmentId,
          studentId: student.id,
          templateId: 1,
          grade: grade,
        });
        if (result.exito && result.data) {
          results.push({ studentId: student.id, data: result.data });
        }
      }

      const currentResult = results.find(r => r.studentId === currentStudent.id);
      if (currentResult) {
        setFeedback(currentResult.data.content);
        setGeneratedFeedbackId(currentResult.data.id);
        setStatusMsg(`Feedback generado exitosamente para ${students.length} estudiantes.`);
      } else {
        setStatusMsg("Feedback generado para todos, pero sin datos para el estudiante actual.");
      }
    } catch (error) {
      logger.error('SpeedGrader', "Error al generar feedback masivo", { error });
      setFeedback(`[ERROR] ${error.message}`);
      setStatusMsg("Error en la generación masiva.");
    } finally {
      setLoading(false);
    }
  }, [currentAssignmentId, currentStudent, students, grade, courseId, setFeedback, setGeneratedFeedbackId, setLoading, setStatusMsg]);

  const handleApprove = useCallback(async (rating) => {
    if (!generatedFeedbackId) return;
    setLoading(true);
    setStatusMsg("Guardando y enviando feedback y nota...");
    try {
      const result = await api.post('/feedback/approve', {
        feedbackId: generatedFeedbackId,
        courseId: courseId,
        assignmentId: currentAssignmentId,
        studentId: currentStudent.id,
        content: feedback,
        grade: grade,
        rating: rating,
      });
      if (!result.exito) throw new Error("Error al aprobar feedback");
      setStatusMsg("¡Enviado exitosamente a Canvas!");
      setGeneratedFeedbackId(null);
    } catch (e) {
      logger.error('SpeedGrader', "Error al enviar feedback", { error: e });
      setStatusMsg("Error al enviar.");
    } finally {
      setLoading(false);
    }
  }, [generatedFeedbackId, currentAssignmentId, currentStudent, feedback, grade, courseId, setGeneratedFeedbackId, setLoading, setStatusMsg]);

  const handleManualSubmit = useCallback(async (manualFeedbackText) => {
    if (!manualFeedbackText) return;
    setLoading(true);
    setStatusMsg("Enviando feedback manual a Canvas...");
    try {
      const result = await api.post('/feedback/manual', {
        courseId: courseId,
        assignmentId: currentAssignmentId,
        studentId: currentStudent.id,
        contenidoManual: manualFeedbackText,
        grade: grade,
      });
      if (!result.exito) throw new Error("Error al enviar feedback manual");
      setStatusMsg("¡Feedback manual enviado exitosamente a Canvas!");
      setFeedback(''); // Opcional, limpiar tras éxito
    } catch (e) {
      logger.error('SpeedGrader', "Error al enviar feedback manual", { error: e });
      setStatusMsg("Error al enviar feedback manual.");
    } finally {
      setLoading(false);
    }
  }, [courseId, currentAssignmentId, currentStudent, grade, setFeedback, setLoading, setStatusMsg]);

  const handleExit = useCallback(
    async (e) => {
      await logExit('SPEEDGRADER_EXIT', () => onExit?.())(e);
    },
    [onExit, logExit]
  );

  return { handleGenerate, handleApprove, handleManualSubmit, handleExit };
}
