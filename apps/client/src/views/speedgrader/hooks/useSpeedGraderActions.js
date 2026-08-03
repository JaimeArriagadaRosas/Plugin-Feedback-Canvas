import { useCallback, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api';
import logger from '../../../utils/logger';

export function useSpeedGraderActions({
  courseId,
  currentAssignmentId,
  currentStudent,
  students = [],
  assignments = [],
  grade,
  feedback,
  generatedFeedbackId,
  setLoading,
  setStatusMsg,
  setFeedback,
  setGeneratedFeedbackId,
  activeAssignment,
  onExit,
  logExit
}) {
  const queryClient = useQueryClient();
  const currentStudentRef = useRef(currentStudent?.id);

  useEffect(() => {
    currentStudentRef.current = currentStudent?.id;
  }, [currentStudent?.id]);

  const handleGenerateMassive = useCallback(async (isRegenerate = false) => {
    setLoading(true);
    setStatusMsg(isRegenerate ? "Generando y regenerando masivamente..." : "Generando masivamente...");
    
    const targetStudentId = currentStudent?.id;
    
    try {
      const activeAssignments = assignments.filter(a => a.active);
      const otherStudents = students.filter(s => s.id !== targetStudentId);

      // 1. Disparar generación masiva en background para los demás
      if (otherStudents.length > 0) {
        api.post('/feedback/generate-all', {
          courseId,
          activeAssignments,
          students: otherStudents,
          isRegenerate
        }).catch(err => logger.error('SpeedGrader', "Error en background generate-all", { err }));
      }

      // 2. Generar síncronamente para el actual, permitiendo capturar errores y mostrar estado de 'Generando...'
      const result = await api.post('/feedback/generate', {
        courseId,
        assignmentId: currentAssignmentId,
        studentId: targetStudentId,
        templateId: activeAssignment?.templateId || 1,
        isRegenerate
      });

      // Solo actualizar la UI si no hemos cambiado de estudiante mientras cargaba
      if (currentStudentRef.current === targetStudentId) {
        if (result.exito && result.data) {
          setFeedback(result.data.content);
          setGeneratedFeedbackId(result.data.id);
          setStatusMsg(isRegenerate ? "Regeneración exitosa. El proceso masivo continúa." : "Generación exitosa. El proceso masivo continúa.");
        } else if (result.omitido) {
          setStatusMsg("Estudiante actual omitido (ya tiene feedback o no aplica).");
        }
      }
      
      queryClient.invalidateQueries({ queryKey: ['feedbackDetail', courseId] });
    } catch (error) {
      logger.error('SpeedGrader', "Error crítico al generar feedback", { error });
      if (currentStudentRef.current === targetStudentId) {
        // Enviar el error directamente a la caja de review
        setFeedback(`[ERROR] ${error.message || "Error al contactar con la IA"}`);
        setStatusMsg("Error en la generación.");
      }
    } finally {
      if (currentStudentRef.current === targetStudentId) {
        setLoading(false);
      }
    }
  }, [assignments, courseId, students, currentAssignmentId, currentStudent, activeAssignment, setLoading, setStatusMsg, setFeedback, setGeneratedFeedbackId, queryClient]);

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
      queryClient.invalidateQueries({ queryKey: ['feedbackDetail', courseId, currentStudent.id] });
    } catch (e) {
      logger.error('SpeedGrader', "Error al enviar feedback", { error: e });
      setStatusMsg("Error al enviar.");
    } finally {
      setLoading(false);
    }
  }, [generatedFeedbackId, currentAssignmentId, currentStudent, feedback, grade, courseId, setGeneratedFeedbackId, setLoading, setStatusMsg, queryClient]);

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
      queryClient.invalidateQueries({ queryKey: ['feedbackDetail', courseId, currentStudent.id] });
    } catch (e) {
      logger.error('SpeedGrader', "Error al enviar feedback manual", { error: e });
      setStatusMsg("Error al enviar feedback manual.");
    } finally {
      setLoading(false);
    }
  }, [courseId, currentAssignmentId, currentStudent, grade, setFeedback, setLoading, setStatusMsg, queryClient]);

  const handleExit = useCallback(
    async (e) => {
      await logExit('SPEEDGRADER_EXIT', () => onExit?.())(e);
    },
    [onExit, logExit]
  );

  return { handleGenerateMassive, handleApprove, handleManualSubmit, handleExit };
}
