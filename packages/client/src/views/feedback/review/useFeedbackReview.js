import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from 'shared/api';
import logger from '../../../utils/logger';

const PROFILE_COLORS = {
  'SOBRESALIENTE': { bg: '#e9f7ef', text: '#1d8348' },
  'PROMEDIO': { bg: '#ebf5fb', text: '#1a5276' },
  'EN RIESGO': { bg: '#fdedec', text: '#922b21' },
  'DESTACADO': { bg: '#efeaf9', text: '#673ab7' },
  'REQUIERE APOYO': { bg: '#fff5e6', text: '#e67e22' }
};

const STATUS_COLORS = {
  'PENDIENTE': { bg: '#fef9e7', text: '#b58900' },
  'EDITADO': { bg: '#eef2f7', text: '#475569' },
  'APROBADO': { bg: '#e9f7ef', text: '#1d8348' },
  'RECHAZADO': { bg: '#fdedec', text: '#922b21' }
};

export function useFeedbackReview() {
  const queryClient = useQueryClient();
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [activeFeedback, setActiveFeedback] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState("Todos");
  const [selectedAssignment, setSelectedAssignment] = useState("Todas");
  const [toastMessage, setToastMessage] = useState(null);
  const [pendingBulkApproval, setPendingBulkApproval] = useState(null);

  const { data: feedbacks = [], isLoading: loading } = useQuery({
    queryKey: ['feedback-list'],
    queryFn: async () => {
      const result = await api.get('/feedback/list');
      if (result.exito && result.data) {
        return result.data;
      }
      return [];
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (feedback) => {
      const result = await api.post('/feedback/approve', {
        feedbackId: feedback.id,
        courseId: feedback.courseId,
        assignmentId: feedback.assignmentId,
        studentId: feedback.studentId,
        content: feedback.feedback,
        rating: feedback.rating || null
      });
      if (!result.exito) throw new Error(result.mensaje || 'Error approving feedback');
      return result;
    },
    onSuccess: () => {
      setShowApprovalModal(false);
      queryClient.invalidateQueries({ queryKey: ['feedback-list'] });
      setToastMessage({ message: "Feedback aprobado con éxito", type: "success" });
    },
    onError: (e) => {
      logger.error('FeedbackReview', "Error al intentar aprobar el feedback", { error: e });
      setToastMessage({ message: "Error al intentar aprobar el feedback.", type: "error" });
    }
  });

  const bulkApproveMutation = useMutation({
    mutationFn: async (feedbackIds) => {
      const result = await api.post('/feedback/bulk-approve', { feedbackIds });
      if (!result.exito) throw new Error(result.mensaje || 'Error bulk approving');
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback-list'] });
      setToastMessage({ message: "Feedbacks aprobados masivamente con éxito.", type: "success" });
      setPendingBulkApproval(null);
    },
    onError: (e) => {
      logger.error('FeedbackReview', "Error en aprobación masiva", { error: e });
      setToastMessage({ message: "Error al intentar aprobar masivamente los feedbacks.", type: "error" });
      setPendingBulkApproval(null);
    }
  });

  const coursesList = useMemo(() => ["Todos", ...new Set(feedbacks.map(fb => fb.courseId).filter(Boolean))], [feedbacks]);
  const assignmentsList = useMemo(() => ["Todas", ...new Set(feedbacks.map(fb => fb.assignmentId).filter(Boolean))], [feedbacks]);

  const filteredFeedbacks = feedbacks.filter(fb => {
    const matchCourse = selectedCourse === "Todos" || String(fb.courseId) === String(selectedCourse);
    const matchAssignment = selectedAssignment === "Todas" || String(fb.assignmentId) === String(selectedAssignment);
    return matchCourse && matchAssignment;
  });

  const handleApprove = useCallback((rating) => {
    if (!activeFeedback) return;
    approveMutation.mutate({ ...activeFeedback, rating });
  }, [activeFeedback, approveMutation]);

  const handleBulkApprove = useCallback(() => {
    const pendingIds = filteredFeedbacks.filter(fb => fb.status === 'PENDIENTE').map(fb => fb.id);
    if (pendingIds.length === 0) {
      setToastMessage({ message: "No hay feedbacks pendientes para aprobar en la vista actual.", type: "info" });
      return;
    }
    setPendingBulkApproval(pendingIds);
  }, [filteredFeedbacks]);

  const confirmBulkApprove = useCallback(() => {
    if (pendingBulkApproval) {
      bulkApproveMutation.mutate(pendingBulkApproval);
    }
  }, [bulkApproveMutation, pendingBulkApproval]);

  const cancelBulkApprove = useCallback(() => {
    setPendingBulkApproval(null);
  }, []);

  const handleExportCSV = useCallback(() => {
    const header = "Estudiante,Curso,Asignacion,Estado,Calificacion IA,Perfil Academico\n";
    const rows = filteredFeedbacks.map(fb =>
      `${fb.student},${fb.courseId},${fb.assignmentId},${fb.status},${fb.grade},${fb.profile}`
    ).join("\n");
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "reporte_feedbacks.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    logger.info('FeedbackReview', "Export CSV generado.", { count: filteredFeedbacks.length });
  }, [filteredFeedbacks]);

  return {
    feedbacks,
    loading,
    filteredFeedbacks,
    selectedCourse,
    setSelectedCourse,
    selectedAssignment,
    setSelectedAssignment,
    coursesList,
    assignmentsList,
    showApprovalModal,
    setShowApprovalModal,
    activeFeedback,
    setActiveFeedback,
    handleApprove,
    handleBulkApprove,
    confirmBulkApprove,
    cancelBulkApprove,
    pendingBulkApproval,
    handleExportCSV,
    toastMessage,
    setToastMessage,
  };
}
