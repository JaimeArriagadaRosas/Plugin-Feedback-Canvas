import { useState, useMemo, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FEEDBACK_STATES, isFinalFeedbackState, isReviewableFeedbackState } from '@plugin-feedback/contracts';
import { api } from '@/api';
import logger from '../../../utils/logger';
import { exportFeedbackExcel } from './exportFeedbackExcel';

const PROFILE_COLORS = {
  'SOBRESALIENTE': { bg: '#e9f7ef', text: '#1d8348' },
  'PROMEDIO': { bg: '#ebf5fb', text: '#1a5276' },
  'EN RIESGO': { bg: '#fdedec', text: '#922b21' },
  'DESTACADO': { bg: '#efeaf9', text: '#673ab7' },
  'REQUIERE APOYO': { bg: '#fff5e6', text: '#e67e22' }
};

const STATUS_COLORS = {
  'PENDIENTE': { bg: '#fef9e7', text: '#b58900' },
  'EDITADO': { bg: '#ebf5fb', text: '#1a5276' },
  'APROBADO': { bg: '#e9f7ef', text: '#1d8348' },
  'ENVIADO': { bg: '#e9f7ef', text: '#1d8348' },
  'RECHAZADO': { bg: '#fdedec', text: '#922b21' }
};

export function useFeedbackReview({ initialSelectedCourse } = {}) {
  const queryClient = useQueryClient();
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [activeFeedback, setActiveFeedback] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(initialSelectedCourse || "Todos");
  const [selectedAssignment, setSelectedAssignment] = useState("Todas");
  const [toastMessage, setToastMessage] = useState(null);
  const [pendingBulkApproval, setPendingBulkApproval] = useState(null);
  const approvalKeysRef = useRef(new Map());
  const approvalInFlightRef = useRef(false);

  const { data: feedbacks = [], isLoading: loading } = useQuery({
    queryKey: ['feedback-list'],
    queryFn: async () => {
      // Obtenemos todos los feedbacks del profesor para que los filtros
      // (coursesList, assignmentsList) siempre tengan todas las opciones disponibles.
      const result = await api.get('/feedback/list');
      if (result.exito && result.data) {
        return result.data;
      }
      return [];
    },
    refetchInterval: 10000,
  });

  const approveMutation = useMutation({
    mutationFn: async (feedback) => {
      let idempotencyKey = approvalKeysRef.current.get(feedback.id);
      if (!idempotencyKey) {
        idempotencyKey = crypto.randomUUID();
        approvalKeysRef.current.set(feedback.id, idempotencyKey);
      }
      const result = await api.post('/feedback/approve', {
        feedbackId: feedback.id,
        courseId: feedback.courseId,
        assignmentId: feedback.assignmentId,
        studentId: feedback.studentId,
        content: feedback.feedback,
        rating: feedback.rating || null
      }, {
        headers: { 'Idempotency-Key': idempotencyKey }
      });
      if (!result.exito) throw new Error(result.mensaje || 'Error approving feedback');
      return result;
    },
    onSuccess: (_result, feedback) => {
      approvalKeysRef.current.delete(feedback.id);
      setShowApprovalModal(false);
      queryClient.invalidateQueries({ queryKey: ['feedback-list'] });
      queryClient.invalidateQueries({ queryKey: ['pending-summary'] });
      setToastMessage({ message: "Feedback aprobado con éxito", type: "success" });
    },
    onError: (e) => {
      logger.error('FeedbackReview', "Error al intentar aprobar el feedback", { error: e });
      setToastMessage({ message: "Error al intentar aprobar el feedback.", type: "error" });
    }
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, templateId }) => {
      const result = await api.put(`/feedback/${id}/reject`, { plantilla_id: templateId });
      if (!result.exito) throw new Error(result.mensaje || 'Error rejecting feedback');
      return result;
    },
    onSuccess: () => {
      setShowApprovalModal(false);
      queryClient.invalidateQueries({ queryKey: ['feedback-list'] });
      queryClient.invalidateQueries({ queryKey: ['pending-summary'] });
      setToastMessage({ message: "Feedback rechazado y regeneración solicitada con éxito", type: "success" });
    },
    onError: (e) => {
      logger.error('FeedbackReview', "Error al intentar rechazar el feedback", { error: e });
      setToastMessage({ message: "Error al intentar rechazar el feedback.", type: "error" });
    }
  });

  const rateMutation = useMutation({
    mutationFn: async ({ id, rating }) => {
      const result = await api.put(`/feedback/${id}/rate`, { rating });
      if (!result.exito) throw new Error(result.mensaje || 'Error rating feedback');
      return result;
    },
    onSuccess: () => {
      setShowApprovalModal(false);
      queryClient.invalidateQueries({ queryKey: ['feedback-list'] });
      queryClient.invalidateQueries({ queryKey: ['pending-summary'] });
      setToastMessage({ message: "Valoración guardada con éxito", type: "success" });
    },
    onError: (e) => {
      logger.error('FeedbackReview', "Error al guardar valoración", { error: e });
      setToastMessage({ message: "Error al intentar guardar la valoración.", type: "error" });
    }
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, nuevoContenido }) => {
      const result = await api.put(`/feedback/${id}`, { nuevoContenido });
      if (!result.exito) throw new Error(result.mensaje || 'Error editing feedback');
      return result;
    },
    onSuccess: () => {
      setShowEditModal(false);
      queryClient.invalidateQueries({ queryKey: ['feedback-list'] });
      queryClient.invalidateQueries({ queryKey: ['pending-summary'] });
      setToastMessage({ message: "Feedback editado con éxito", type: "success" });
    },
    onError: (e) => {
      logger.error('FeedbackReview', "Error al intentar editar el feedback", { error: e });
      setToastMessage({ message: "Error al intentar editar el feedback.", type: "error" });
    }
  });

  const privateNoteMutation = useMutation({
    mutationFn: async ({ id, nota_privada }) => {
      const result = await api.put(`/private-notes/${id}`, { nota_privada });
      if (!result.exito) throw new Error(result.mensaje || 'Error saving private note');
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback-list'] });
      queryClient.invalidateQueries({ queryKey: ['pending-summary'] });
      setToastMessage({ message: "Nota privada guardada con éxito", type: "success" });
    },
    onError: (error) => {
      setToastMessage({ message: error.message || "Error al guardar nota privada", type: "error" });
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
      queryClient.invalidateQueries({ queryKey: ['pending-summary'] });
      setToastMessage({ message: "Feedbacks aprobados masivamente con éxito.", type: "success" });
      setPendingBulkApproval(null);
    },
    onError: (e) => {
      logger.error('FeedbackReview', "Error en aprobación masiva", { error: e });
      setToastMessage({ message: "Error al intentar aprobar masivamente los feedbacks.", type: "error" });
      setPendingBulkApproval(null);
    }
  });

  const coursesList = useMemo(() => {
    const uniqueCourses = new Map();
    feedbacks.forEach(fb => {
      if (fb.courseId) {
        uniqueCourses.set(String(fb.courseId), fb.courseName || `Curso ${fb.courseId}`);
      }
    });
    return [
      { value: 'Todos', label: 'Todos los Cursos' },
      ...Array.from(uniqueCourses.entries()).map(([id, name]) => ({ value: id, label: name }))
    ];
  }, [feedbacks]);

  const assignmentsList = useMemo(() => {
    let list = feedbacks;
    if (selectedCourse !== "Todos") {
      list = feedbacks.filter(fb => String(fb.courseId) === String(selectedCourse));
    }
    const uniqueAssignments = new Map();
    list.forEach(fb => {
      if (fb.assignmentId) {
        uniqueAssignments.set(String(fb.assignmentId), fb.assignmentName || `Asignación ${fb.assignmentId}`);
      }
    });
    return [
      { value: 'Todas', label: 'Todas las Asignaciones' },
      ...Array.from(uniqueAssignments.entries()).map(([id, name]) => ({ value: id, label: name }))
    ];
  }, [feedbacks, selectedCourse]);

  const filteredFeedbacks = useMemo(() => {
    const filtered = feedbacks.filter(fb => {
      const matchCourse = selectedCourse === "Todos" || String(fb.courseId) === String(selectedCourse);
      const matchAssignment = selectedAssignment === "Todas" || String(fb.assignmentId) === String(selectedAssignment);
      return matchCourse && matchAssignment;
    });

    return filtered.sort((a, b) => {
      if (a.status === FEEDBACK_STATES.PENDING && b.status !== FEEDBACK_STATES.PENDING) return -1;
      if (a.status !== FEEDBACK_STATES.PENDING && b.status === FEEDBACK_STATES.PENDING) return 1;
      return 0;
    });
  }, [feedbacks, selectedCourse, selectedAssignment]);

  const [selectedIds, setSelectedIds] = useState(new Set());

  const toggleSelection = useCallback((id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAllSelection = useCallback((ids) => {
    setSelectedIds(prev => prev.size === ids.length && ids.length > 0 ? new Set() : new Set(ids));
  }, []);

  const handleApprove = useCallback(async (rating, privateNote) => {
    if (!activeFeedback || approvalInFlightRef.current) return;
    approvalInFlightRef.current = true;
    let approved = false;

    try {
      if (privateNote !== activeFeedback.nota_privada && privateNote !== undefined) {
        await privateNoteMutation.mutateAsync({ id: activeFeedback.id, nota_privada: privateNote });
      }

      if (isFinalFeedbackState(activeFeedback.status)) {
        await rateMutation.mutateAsync({ id: activeFeedback.id, rating });
      } else {
        await approveMutation.mutateAsync({ ...activeFeedback, rating });
      }
      approved = true;
    } catch (error) {
      // Error handled by useMutation onError
    } finally {
      approvalInFlightRef.current = false;
      if (approved) setShowApprovalModal(false);
    }
  }, [activeFeedback, approveMutation, rateMutation, privateNoteMutation, setShowApprovalModal]);

  const handleReject = useCallback(async (templateId) => {
    if (!activeFeedback || approvalInFlightRef.current) return;
    approvalInFlightRef.current = true;
    let rejected = false;
    try {
      await rejectMutation.mutateAsync({ id: activeFeedback.id, templateId });
      rejected = true;
    } catch (error) {
      // Error handled by useMutation onError
    } finally {
      approvalInFlightRef.current = false;
      if (rejected) setShowApprovalModal(false);
    }
  }, [activeFeedback, rejectMutation, setShowApprovalModal]);

  const handleEditSave = useCallback((nuevoContenido) => {
    if (!activeFeedback) return;
    editMutation.mutate({ id: activeFeedback.id, nuevoContenido });
  }, [activeFeedback, editMutation]);

  const handleBulkApprove = useCallback(() => {
    if (selectedIds.size === 0) {
      setToastMessage({ message: "Debes seleccionar al menos un feedback pendiente o editado usando las casillas.", type: "info" });
      return;
    }
    const pendingIds = filteredFeedbacks
      .filter((feedback) => isReviewableFeedbackState(feedback.status) && selectedIds.has(feedback.id))
      .map(fb => fb.id);
      
    if (pendingIds.length === 0) {
      setToastMessage({ message: "Los feedbacks seleccionados no están pendientes ni editados.", type: "info" });
      return;
    }
    setPendingBulkApproval(pendingIds);
  }, [filteredFeedbacks, selectedIds]);

  const confirmBulkApprove = useCallback(() => {
    if (pendingBulkApproval) {
      const ids = pendingBulkApproval;
      setPendingBulkApproval(null);
      bulkApproveMutation.mutate(ids);
      setToastMessage({ message: "Iniciando aprobación masiva en segundo plano...", type: "info" });
    }
  }, [bulkApproveMutation, pendingBulkApproval]);

  const cancelBulkApprove = useCallback(() => {
    setPendingBulkApproval(null);
  }, []);

  const handleExportExcel = useCallback(async () => {
    try {
      await exportFeedbackExcel(filteredFeedbacks);
    } catch (error) {
      setToastMessage({ message: "Error al generar el reporte Excel.", type: "error" });
    }
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
    showEditModal,
    setShowEditModal,
    activeFeedback,
    setActiveFeedback,
    handleApprove,
    handleReject,
    handleEditSave,
    handleBulkApprove,
    confirmBulkApprove,
    cancelBulkApprove,
    pendingBulkApproval,
    handleExportExcel,
    toastMessage,
    setToastMessage,
    selectedIds,
    toggleSelection,
    toggleAllSelection,
    isApprovalSubmitting: approveMutation.isPending || rateMutation.isPending || privateNoteMutation.isPending,
  };
}
