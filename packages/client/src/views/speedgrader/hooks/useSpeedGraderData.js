import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from 'shared/api';
import logger from '../../../utils/logger';

export function useSpeedGraderData() {
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

  const courseId = meData?.courseId;

  const { data: assignments = [] } = useQuery({
    queryKey: ['assignments', courseId],
    queryFn: async () => {
      if (!courseId) return [];
      const result = await api.get(`/courses/${courseId}/assignments`);
      if (result.exito && result.data) {
        return result.data.map(a => ({ id: a.id, name: a.name, points: a.points_possible || 100 }));
      }
      return [];
    },
    enabled: !!courseId,
  });

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

  const { data: submissionData } = useQuery({
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
    onSuccess: (data) => {
      if (data) {
        const body = data.body || data.preview_url || "Sin contenido de entrega.";
        queryClient.setQueryData(['submissions', courseId, currentAssignmentId], (old = {}) => ({
          ...old,
          [currentStudent.id]: body.replace(/<[^>]+>/g, '')
        }));
        setGrade(data.score || 0);
        setStatusMsg("Listo para generar feedback.");
      }
    },
    onError: (e) => {
      logger.error('SpeedGrader', "Error cargando entrega", { error: e });
      setStatusMsg("Error cargando entrega.");
    },
  });

  const submissionText = submissionData
    ? (submissionData.body || submissionData.preview_url || "Sin contenido de entrega.").replace(/<[^>]+>/g, '')
    : "Sin entrega.";

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
    submissionText,
    activeAssignment,
    feedback,
    setFeedback,
    generatedFeedbackId,
    setGeneratedFeedbackId,
  };
}
