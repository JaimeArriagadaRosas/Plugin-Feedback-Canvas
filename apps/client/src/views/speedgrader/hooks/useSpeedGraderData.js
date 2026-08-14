import { useState, useCallback, useEffect } from 'react';
import sanitizeHtml from 'sanitize-html';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api';
import { assignmentKeys } from '@/lib/queryKeys';
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

  const isAiServiceAvailable = meData?.isAiServiceAvailable ?? true;

  const { data: assignments = [], isFetching: isAssignmentsLoading } = useQuery({
    queryKey: assignmentKeys.speedgrader(courseId),
    queryFn: async () => {
      if (!courseId) return [];
      const result = await api.get(`/courses/${courseId}/assignments`);
      if (result.exito && result.data) {
        return result.data
          .filter(a => Boolean(a.active) === true)
          .map(a => ({
            id: a.id,
            name: a.name,
            points: a.points_possible,
            templateId: a.template || "",
            templateName: a.templateName || "",
            rubric: Array.isArray(a.rubric) ? a.rubric : [],
            hasRubric: a.use_rubric_for_grading === true || a.has_rubric === true || !!(Array.isArray(a.rubric) && a.rubric.length > 0),
            active: Boolean(a.active)
          }));
      }
      return [];
    },

    enabled: !!courseId,
  });

  // Inicializar o auto-corregir la tarea seleccionada (Watchdog SRP)
  useEffect(() => {
    if (assignments.length === 0) {
      if (currentAssignmentId !== null) setCurrentAssignmentId(null);
      return;
    }
    
    if (!currentAssignmentId) {
      setCurrentAssignmentId(assignments[0].id);
      return;
    }
    
    // Si hay un ID pero ya no existe en la lista de tareas activas, forzamos corrección
    const isStillValid = assignments.some(a => a.id === currentAssignmentId);
    if (!isStillValid) {
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

  const { data: submissionData, error: submissionError, isFetching: isFetchingSubmissionQuery, isPending: isSubmissionPending } = useQuery({
    queryKey: ['submission', courseId, currentAssignmentId, currentStudent.id],
    queryFn: async () => {
      if (!courseId || !currentAssignmentId || !currentStudent.id) return null;
      // Usamos quiz-details porque devuelve la entrega y, si es un cuestionario, las preguntas
      const result = await api.get(`/courses/${courseId}/assignments/${currentAssignmentId}/quiz-details/${currentStudent.id}`);
      if (result.exito && result.data) {
        return result.data; // { submission, questions, latestAttempt }
      }
      return null;
    },
    enabled: !!courseId && !!currentAssignmentId && !!currentStudent.id && students.length > 0 && isAiServiceAvailable,
  });

  const isFetchingSubmission = isAiServiceAvailable 
    ? (isFetchingSubmissionQuery || isSubmissionPending) 
    : false;

  // Limpiar estado cuando se cambia la tarea o el estudiante
  useEffect(() => {
    setGrade(0);
    setStatusMsg("Cargando datos desde Canvas...");
    setFeedback("");
    setGeneratedFeedbackId(null);
  }, [currentAssignmentId, currentStudent.id]);

  const { data: feedbackDetailList } = useQuery({
    queryKey: ['feedbackDetail', courseId, currentStudent.id],
    queryFn: async () => {
      if (!courseId || !currentStudent.id) return null;
      const result = await api.get(`/feedback/detail?studentId=${currentStudent.id}&courseId=${courseId}`);
      if (result.exito && result.data && Array.isArray(result.data)) {
        return result.data;
      }
      return null;
    },
    enabled: !!courseId && !!currentStudent.id,
    refetchInterval: 15000, // Polling cada 15 segundos para actualizar feedback generado en segundo plano
  });

  const feedbackDetail = feedbackDetailList?.find(fb => fb.assignmentId == currentAssignmentId) || null;

  const submission = submissionData?.submission || null;
  const quizDetails = submissionData ? {
    questions: submissionData.questions || [],
    latestAttempt: submissionData.latestAttempt || null
  } : null;

  useEffect(() => {
    if (!isAiServiceAvailable) {
      setGrade(0);
      setStatusMsg("Modo de solo lectura. API de IA inactiva.");
      return;
    }
    
    if (submission) {
      const body = submission.body || submission.preview_url || "Sin contenido de entrega.";
      queryClient.setQueryData(['submissions', courseId, currentAssignmentId], (old = {}) => ({
        ...old,
        [currentStudent.id]: sanitizeHtml(body, { allowedTags: [], allowedAttributes: {} })
      }));
      setGrade(submission.score || 0);
      setStatusMsg("Listo para generar feedback.");
    }
  }, [submission, courseId, currentAssignmentId, currentStudent.id, queryClient, isAiServiceAvailable]);

  // Si hay feedback pendiente en la base de datos para este estudiante/tarea, lo inyectamos
  useEffect(() => {
    if (feedbackDetail) {
      setFeedback(feedbackDetail.feedback || "");
      setGeneratedFeedbackId(feedbackDetail.id);
    } else {
      setFeedback("");
      setGeneratedFeedbackId(null);
    }
  }, [feedbackDetail, currentAssignmentId, currentStudent.id]);

  useEffect(() => {
    if (submissionError) {
      logger.error('SpeedGrader', "Error cargando entrega", { error: submissionError });
      setStatusMsg("Error cargando entrega.");
    }
  }, [submissionError]);

  const isFeedbackApproved = feedbackDetail?.status === 'APROBADO';
  const activeAssignment = assignments.find(a => a.id === currentAssignmentId) || assignments[0] || { name: "", points: null };

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
    quizDetails,
    activeAssignment,
    feedback,
    setFeedback,
    generatedFeedbackId,
    setGeneratedFeedbackId,
    isFeedbackApproved,
    isFetchingSubmission,
    isAssignmentsLoading,
    isAiServiceAvailable,
  };
}
