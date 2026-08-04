import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api';
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
  'EDITADO': { bg: '#ebf5fb', text: '#1a5276' },
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
    refetchInterval: 10000,
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

  const rejectMutation = useMutation({
    mutationFn: async ({ id, templateId }) => {
      const result = await api.put(`/feedback/${id}/reject`, { plantilla_id: templateId });
      if (!result.exito) throw new Error(result.mensaje || 'Error rejecting feedback');
      return result;
    },
    onSuccess: () => {
      setShowApprovalModal(false);
      queryClient.invalidateQueries({ queryKey: ['feedback-list'] });
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
      setToastMessage({ message: "Nota privada guardada con éxito", type: "success" });
    },
    onError: (e) => {
      logger.error('FeedbackReview', "Error al guardar nota privada", { error: e });
      setToastMessage({ message: "Error al intentar guardar la nota privada.", type: "error" });
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

  const handleApprove = useCallback((rating, privateNote) => {
    if (!activeFeedback) return;
    
    // Save private note if changed
    if (privateNote !== activeFeedback.nota_privada && privateNote !== undefined) {
      privateNoteMutation.mutate({ id: activeFeedback.id, nota_privada: privateNote });
    }

    if (activeFeedback.status === 'APROBADO' || activeFeedback.status === 'ENVIADO') {
      rateMutation.mutate({ id: activeFeedback.id, rating });
    } else {
      approveMutation.mutate({ ...activeFeedback, rating });
    }
  }, [activeFeedback, approveMutation, rateMutation, privateNoteMutation]);

  const handleReject = useCallback((templateId) => {
    if (!activeFeedback) return;
    rejectMutation.mutate({ id: activeFeedback.id, templateId });
  }, [activeFeedback, rejectMutation]);

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
      .filter(fb => (fb.status === 'PENDIENTE' || fb.status === 'EDITADO') && selectedIds.has(fb.id))
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
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();

      let countValoracionEstudiante = 0;
      let sumaValoracionEstudiante = 0;
      let countTotalEvaluacionesUtilidad = 0;
      let countEvaluacionesUtiles = 0;

      filteredFeedbacks.forEach(fb => {
        if (fb.studentRating) {
          sumaValoracionEstudiante += Number(fb.studentRating);
          countValoracionEstudiante++;
        }
        if (fb.isUseful !== null && fb.isUseful !== undefined) {
          countTotalEvaluacionesUtilidad++;
          if (fb.isUseful === true) {
            countEvaluacionesUtiles++;
          }
        }
      });

      const avgEstudiante = countValoracionEstudiante > 0 ? (sumaValoracionEstudiante / countValoracionEstudiante).toFixed(1) : 'N/A';
      const porcentajeUtilidad = countTotalEvaluacionesUtilidad > 0 ? ((countEvaluacionesUtiles / countTotalEvaluacionesUtilidad) * 100).toFixed(1) + '%' : 'N/A';

      const styleHeader = (sheet) => {
        const headerRow = sheet.getRow(1);
        headerRow.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0374B5' } };
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });
      };

      const sheetUtilidad = workbook.addWorksheet('Utilidad del Feedback');
      sheetUtilidad.columns = [
        { header: 'Métrica de Utilidad (Estudiantes)', key: 'metrica', width: 45 },
        { header: 'Valor', key: 'valor', width: 20 }
      ];
      sheetUtilidad.addRow({ metrica: 'Total de Evaluaciones de Utilidad', valor: countTotalEvaluacionesUtilidad });
      sheetUtilidad.addRow({ metrica: 'Total de Feedbacks Considerados Útiles', valor: countEvaluacionesUtiles });
      sheetUtilidad.addRow({ metrica: 'Porcentaje de Utilidad', valor: porcentajeUtilidad });
      sheetUtilidad.addRow({ metrica: 'Promedio Valoración (Escala 1-5)', valor: avgEstudiante !== 'N/A' ? `${avgEstudiante} ⭐` : 'N/A' });
      styleHeader(sheetUtilidad);

      const worksheet = workbook.addWorksheet('Feedbacks');
      worksheet.columns = [
        { header: 'Estudiante', key: 'student', width: 25 },
        { header: 'Curso', key: 'courseId', width: 10 },
        { header: 'Asignacion', key: 'assignmentId', width: 15 },
        { header: 'Estado', key: 'status', width: 15 },
        { header: 'Calificacion IA', key: 'grade', width: 20 },
        { header: 'Perfil Academico', key: 'profile', width: 25 },
        { header: '¿Fue Útil? (Sí/No)', key: 'isUseful', width: 20 },
        { header: 'Valoración Estudiante', key: 'studentRating', width: 20 }
      ];

      filteredFeedbacks.forEach(fb => {
        worksheet.addRow({
          student: fb.student || '',
          courseId: fb.courseName || fb.courseId || '',
          assignmentId: fb.assignmentName || fb.assignmentId || '',
          status: fb.status || '',
          grade: fb.grade || '',
          profile: fb.profile || '',
          isUseful: fb.isUseful !== null && fb.isUseful !== undefined ? (fb.isUseful ? 'Sí' : 'No') : 'N/A',
          studentRating: fb.studentRating ? `${fb.studentRating} ⭐` : 'N/A'
        });
      });

      styleHeader(worksheet);

      // --- Hoja: Notificaciones de Sistema ---
      let systemErrors = [];
      try {
        const errorRes = await api.get('/system-notifications/pending');
        if (errorRes.exito) {
          systemErrors = errorRes.data || [];
        }
      } catch (e) {
        logger.error('FeedbackReview', "Error fetching system notifications for excel", { error: e });
      }

      const sheetErrores = workbook.addWorksheet('Notificaciones de Sistema');
      sheetErrores.columns = [
        { header: 'Tipo Error', key: 'tipo_error', width: 25 },
        { header: 'Descripción', key: 'descripcion', width: 60 },
        { header: 'Cantidad', key: 'count', width: 15 }
      ];
      
      const errorLabels = {
        'CANVAS_CONNECTION_FAILED': 'Fallo conexión Canvas',
        'AI_GENERATION_FAILED': 'Error generación IA',
        'INSUFFICIENT_DATA': 'Datos insuficientes',
        'NOTIFICATION_FAILED': 'Fallo envío notificación'
      };

      const errorDescriptions = {
        'CANVAS_CONNECTION_FAILED': 'El servidor no pudo comunicarse con la API de Canvas (timeout o endpoint inaccesible). Verifica que Canvas esté operativo y respondiendo.',
        'AI_GENERATION_FAILED': 'Ocurrió un fallo con la Inteligencia Artificial al procesar el prompt (ej. límite de peticiones alcanzado o error interno del proveedor).',
        'INSUFFICIENT_DATA': 'No se pudo procesar la solicitud porque el estudiante no ha entregado la asignación o la rúbrica carece de evaluación.',
        'NOTIFICATION_FAILED': 'El sistema falló al intentar despachar el mensaje o correo de notificación de feedback generado al estudiante.'
      };

      if (systemErrors.length > 0) {
        systemErrors.forEach(err => {
          sheetErrores.addRow({
            tipo_error: errorLabels[err.tipo_error] || err.tipo_error,
            descripcion: errorDescriptions[err.tipo_error] || 'Error detectado en el sistema sin descripción detallada.',
            count: err.cantidad
          });
        });
      } else {
        sheetErrores.addRow({
          tipo_error: 'No hay notificaciones',
          descripcion: 'Sin errores',
          count: 0
        });
      }
      styleHeader(sheetErrores);

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
  };
}
