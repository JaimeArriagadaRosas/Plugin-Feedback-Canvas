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
  logExit,
  setIsManualMode,
  isAssignmentsLoading
}) {
  const queryClient = useQueryClient();
  const currentStudentRef = useRef(currentStudent?.id);

  useEffect(() => {
    currentStudentRef.current = currentStudent?.id;
  }, [currentStudent?.id]);

  const handleGenerateMassive = useCallback(async (isRegenerate = false) => {
    if (isAssignmentsLoading) {
      alert("Por favor espere a que todas las tareas terminen de cargar antes de generar el feedback masivo.");
      return;
    }

    setLoading(true);
    setStatusMsg(isRegenerate ? "Generando y regenerando masivamente..." : "Generando masivamente...");
    
    const targetStudentId = currentStudent?.id;
    
    try {
      const activeAssignments = assignments.filter(a => a.active);
      const otherStudents = students.filter(s => s.id !== targetStudentId);
      const otherAssignments = activeAssignments.filter(a => a.id !== currentAssignmentId);

      // 1. Disparar generación masiva en background para los DEMÁS estudiantes (en todas las tareas)
      if (otherStudents.length > 0) {
        api.post('/feedback/generate-all', {
          courseId,
          activeAssignments,
          students: otherStudents,
          isRegenerate
        }).catch(err => logger.error('SpeedGrader', "Error en background generate-all others", { err }));
      }

      // 2. Disparar generación masiva en background para el ESTUDIANTE ACTUAL (en las demás tareas)
      if (otherAssignments.length > 0 && targetStudentId) {
        api.post('/feedback/generate-all', {
          courseId,
          activeAssignments: otherAssignments,
          students: [{ id: targetStudentId }],
          isRegenerate
        }).catch(err => logger.error('SpeedGrader', "Error en background generate-all current student", { err }));
      }

      // 3. Generar síncronamente para el actual en la tarea actual, permitiendo capturar errores y mostrar estado de 'Generando...'
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
      queryClient.invalidateQueries({ queryKey: ['pending-summary'] });
      queryClient.invalidateQueries({ queryKey: ['feedback-list'] });
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
  }, [assignments, courseId, students, currentAssignmentId, currentStudent, activeAssignment, setLoading, setStatusMsg, setFeedback, setGeneratedFeedbackId, queryClient, isAssignmentsLoading]);

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
      queryClient.invalidateQueries({ queryKey: ['feedbackDetail', courseId, currentStudent.id] });
      queryClient.invalidateQueries({ queryKey: ['pending-summary'] });
      queryClient.invalidateQueries({ queryKey: ['feedback-list'] });
    } catch (e) {
      logger.error('SpeedGrader', "Error al enviar feedback", { error: e });
      setStatusMsg("Error al enviar.");
    } finally {
      setLoading(false);
    }
  }, [generatedFeedbackId, currentAssignmentId, currentStudent, feedback, grade, courseId, setGeneratedFeedbackId, setLoading, setStatusMsg, queryClient]);

  const handleManualSubmit = useCallback(async (text) => {
    if (!text) return;
    setLoading(true);
    setStatusMsg("Guardando feedback manual como pendiente...");
    try {
      const result = await api.post('/feedback/manual', {
        courseId,
        assignmentId: currentAssignmentId,
        studentId: currentStudent.id,
        content: text,
        grade: grade
      });
      if (!result.exito) throw new Error("Error al enviar feedback manual");
      setStatusMsg("¡Feedback manual guardado como pendiente exitosamente!");
      
      if (result.data) {
        setFeedback(result.data.contenido_generado || text);
        setGeneratedFeedbackId(result.data.id);
      }
      if (setIsManualMode) {
        setIsManualMode(false);
      }
      
      queryClient.invalidateQueries({ queryKey: ['feedbackDetail', courseId, currentStudent.id] });
      queryClient.invalidateQueries({ queryKey: ['pending-summary'] });
      queryClient.invalidateQueries({ queryKey: ['feedback-list'] });
    } catch (e) {
      logger.error('SpeedGrader', "Error al enviar feedback manual", { error: e });
      setStatusMsg("Error al enviar feedback manual.");
    } finally {
      setLoading(false);
    }
  }, [courseId, currentAssignmentId, currentStudent, grade, setFeedback, setLoading, setStatusMsg, queryClient, setGeneratedFeedbackId, setIsManualMode]);

  const handleExit = useCallback(
    async (e) => {
      await logExit('SPEEDGRADER_EXIT', () => onExit?.())(e);
    },
    [onExit, logExit]
  );

  return { handleGenerateMassive, handleApprove, handleManualSubmit, handleExit };
}
