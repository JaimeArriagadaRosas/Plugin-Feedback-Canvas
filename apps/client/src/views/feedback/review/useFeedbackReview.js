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

export function useFeedbackReview({ initialSelectedCourse } = {}) {
  const queryClient = useQueryClient();
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [activeFeedback, setActiveFeedback] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(initialSelectedCourse || "Todos");
  const [selectedAssignment, setSelectedAssignment] = useState("Todas");
  const [toastMessage, setToastMessage] = useState(null);
  const [pendingBulkApproval, setPendingBulkApproval] = useState(null);

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
    refetchInterval: 10000, // Carga dinámica periódica cada 10s
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

  const rateMutation = useMutation({
    mutationFn: async ({ id, rating }) => {
      const result = await api.put(`/feedback/${id}/rate`, { rating });
      if (!result.exito) throw new Error(result.mensaje || 'Error rating feedback');
      return result;
    },
    onSuccess: () => {
      setShowApprovalModal(false);
      queryClient.invalidateQueries({ queryKey: ['feedback-list'] });
      setToastMessage({ message: "Valoración guardada con éxito", type: "success" });
    },
    onError: (e) => {
      logger.error('FeedbackReview', "Error al guardar valoración", { error: e });
      setToastMessage({ message: "Error al intentar guardar la valoración.", type: "error" });
    }
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, nuevoContenido }) => {
      const result = await api.put(`/feedback/update/${id}`, { nuevoContenido });
      if (!result.exito) throw new Error(result.mensaje || 'Error editing feedback');
      return result;
    },
    onSuccess: () => {
      setShowEditModal(false);
      queryClient.invalidateQueries({ queryKey: ['feedback-list'] });
      setToastMessage({ message: "Feedback editado con éxito", type: "success" });
    },
    onError: (e) => {
      logger.error('FeedbackReview', "Error al intentar editar el feedback", { error: e });
      setToastMessage({ message: "Error al intentar editar el feedback.", type: "error" });
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
      if (a.status === 'PENDIENTE' && b.status !== 'PENDIENTE') return -1;
      if (a.status !== 'PENDIENTE' && b.status === 'PENDIENTE') return 1;
      return 0;
    });
  }, [feedbacks, selectedCourse, selectedAssignment]);

  const handleApprove = useCallback((rating) => {
    if (!activeFeedback) return;
    if (activeFeedback.status === 'APROBADO' || activeFeedback.status === 'ENVIADO') {
      rateMutation.mutate({ id: activeFeedback.id, rating });
    } else {
      approveMutation.mutate({ ...activeFeedback, rating });
    }
  }, [activeFeedback, approveMutation, rateMutation]);

  const handleEditSave = useCallback((nuevoContenido) => {
    if (!activeFeedback) return;
    editMutation.mutate({ id: activeFeedback.id, nuevoContenido });
  }, [activeFeedback, editMutation]);

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
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Feedbacks');

      worksheet.columns = [
        { header: 'Estudiante', key: 'student', width: 25 },
        { header: 'Curso', key: 'courseId', width: 10 },
        { header: 'Asignacion', key: 'assignmentId', width: 15 },
        { header: 'Estado', key: 'status', width: 15 },
        { header: 'Calificacion IA', key: 'grade', width: 20 },
        { header: 'Perfil Academico', key: 'profile', width: 25 }
      ];

      filteredFeedbacks.forEach(fb => {
        worksheet.addRow({
          student: fb.student || '',
          courseId: fb.courseName || fb.courseId || '',
          assignmentId: fb.assignmentName || fb.assignmentId || '',
          status: fb.status || '',
          grade: fb.grade || '',
          profile: fb.profile || ''
        });
      });

      const headerRow = worksheet.getRow(1);
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF0374B5' }
        };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", "reporte_feedbacks.xlsx");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      logger.info('FeedbackReview', "Export Excel generado.", { count: filteredFeedbacks.length });
    } catch (error) {
      logger.error('FeedbackReview', "Error generando Excel", { error });
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
    handleEditSave,
    handleBulkApprove,
    confirmBulkApprove,
    cancelBulkApprove,
    pendingBulkApproval,
    handleExportExcel,
    toastMessage,
    setToastMessage,
  };
}
