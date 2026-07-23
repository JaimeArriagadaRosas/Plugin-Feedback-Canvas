import { useState, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from 'shared/api';
import logger from '../../../utils/logger';

export function useSpeedGraderData() {
  const { courseId } = useParams();
  const queryClient = useQueryClient();
  const [currentAssignmentId, setCurrentAssignmentId] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [grade, setGrade] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [generatedFeedbackId, setGeneratedFeedbackId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("Cargando datos desde Canvas...");

  const { data: meData } = useQuery({
    queryKey: ['config', 'me'],
    queryFn: async () => {
      const result = await api.get('/config/me');
      if (result.exito) return result;
      throw new Error(result.mensaje || 'Error loading config');
    },
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ['assignments', courseId],
    queryFn: async () => {
      if (!courseId) return [];
      const result = await api.get(`/courses/${courseId}/assignments`);
      if (result.exito && result.data) {
        return result.data
          .filter(a => Boolean(a.active) === true)
          .map(a => ({
            id: a.id,
            name: a.name,
            points: a.points_possible || 100,
            templateName: a.templateName || ""
          }));
      }
      return [];
    },
    enabled: !!courseId,
  });

  // Inicializar la tarea si no hay ninguna seleccionada
  useEffect(() => {
    if (assignments.length > 0 && !currentAssignmentId) {
      setCurrentAssignmentId(assignments[0].id);
    }
  }, [assignments, currentAssignmentId]);

  const { data: students = [] } = useQuery({
    queryKey: ['students', courseId],
    queryFn: async () => {
      if (!courseId) return [];
      const result = await api.get(`/courses/${courseId}/students`);
      if (result.exito && result.data) {
        return result.data.map(s => ({ id: s.id, name: s.name || s.short_name }));
      }
      return [];
    },
    enabled: !!courseId,
  });

  const currentStudent = students[currentIndex] || { id: 0, name: "Sin Estudiante" };

  const { data: submissionData, error: submissionError, isFetching: isFetchingSubmission } = useQuery({
    queryKey: ['submission', courseId, currentAssignmentId, currentStudent.id],
    queryFn: async () => {
      if (!courseId || !currentAssignmentId || !currentStudent.id) return null;
      const result = await api.get(`/courses/${courseId}/assignments/${currentAssignmentId}/submissions/${currentStudent.id}`);
      if (result.exito && result.data) {
        return result.data;
      }
      return null;
    },
    enabled: !!courseId && !!currentAssignmentId && !!currentStudent.id && students.length > 0,
  });

  // Limpiar estado cuando se cambia la tarea o el estudiante
  useEffect(() => {
    setGrade(0);
    setFeedback("");
    setGeneratedFeedbackId(null);
    setStatusMsg("Cargando datos desde Canvas...");
  }, [currentAssignmentId, currentStudent.id]);

  useEffect(() => {
    if (submissionData) {
      const body = submissionData.body || submissionData.preview_url || "Sin contenido de entrega.";
      queryClient.setQueryData(['submissions', courseId, currentAssignmentId], (old = {}) => ({
        ...old,
        [currentStudent.id]: body.replace(/<[^>]+>/g, '')
      }));
      setGrade(submissionData.score || 0);
      setStatusMsg("Listo para generar feedback.");
    }
  }, [submissionData, courseId, currentAssignmentId, currentStudent.id, queryClient]);

  useEffect(() => {
    if (submissionError) {
      logger.error('SpeedGrader', "Error cargando entrega", { error: submissionError });
      setStatusMsg("Error cargando entrega.");
    }
  }, [submissionError]);

  const submission = submissionData || null;

  const activeAssignment = assignments.find(a => a.id === currentAssignmentId) || assignments[0] || { name: "", points: 0 };

  return {
    courseId,
    assignments,
    students,
    currentAssignmentId,
    setCurrentAssignmentId,
    currentIndex,
    setCurrentIndex,
    grade,
    setGrade,
    loading,
    setLoading,
    statusMsg,
    setStatusMsg,
    currentStudent,
    submission,
    activeAssignment,
    feedback,
    setFeedback,
    generatedFeedbackId,
    setGeneratedFeedbackId,
    isFetchingSubmission,
  };
}
