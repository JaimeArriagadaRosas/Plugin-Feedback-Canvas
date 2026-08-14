import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api';
import { assignmentKeys } from '@/lib/queryKeys';
import logger from '../../../utils/logger';

export function useAssignmentList(course) {
  const queryClient = useQueryClient();
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [showToast, setShowToast] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const { data: assignments = [], isLoading: loading, refetch, isFetching, isError, error } = useQuery({
    queryKey: assignmentKeys.byCourse(course?.id),
    queryFn: async ({ queryKey }) => {
      const [, id] = queryKey;
      if (!id) return [];
      const result = await api.get(`/courses/${id}/assignments`);
      if (!result.exito) {
        throw new Error(result.mensaje || 'Error al obtener tareas');
      }
      if (result.data) {
        return result.data.map(a => ({
          id: a.id,
          name: a.name,
          due: a.due_at ? new Date(a.due_at).toLocaleDateString() : 'Sin fecha',
          rubric: a.use_rubric_for_grading === true || a.has_rubric === true || !!(Array.isArray(a.rubric) && a.rubric.length > 0),
          template: a.template || "",
          plantilla_id: a.template || null,
          templateName: a.templateName || "",
          active: Boolean(a.active)
        }));
      }
      return [];
    },
    enabled: !!course?.id,
  });

  // Task 23: Reseteo inicial por sesión
  useEffect(() => {
    if (!course?.id) return;
    const sessionKey = `plugin_session_init_${course.id}`;
    if (!sessionStorage.getItem(sessionKey)) {
      logger.info('AssignmentList', `Primera visita de la sesión para curso ${course.id}. Desactivando tareas por defecto...`);
      sessionStorage.setItem(sessionKey, 'true');
      api.post(`/courses/${course.id}/assignments/reset-active`).then(() => {
        queryClient.invalidateQueries({ queryKey: assignmentKeys.all });
      }).catch(err => {
        logger.warn('AssignmentList', 'No se pudo reiniciar el estado de la sesión:', err);
      });
    }
  }, [course?.id, queryClient]);

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, plantilla_id, variables = [] }) => {
      if (!course?.id) throw new Error('Missing course id');
      const result = await api.post(`/courses/${course.id}/assignments/${id}/toggle`, {
        activo: status,
        plantilla_id: plantilla_id || null,
        variables
      });
      if (!result.exito) throw new Error(result.mensaje || 'Error updating assignment');
      return result;
    },
    onMutate: async ({ id, status, plantilla_id }) => {
      await queryClient.cancelQueries({ queryKey: assignmentKeys.all });
      const previous = queryClient.getQueryData(assignmentKeys.byCourse(course?.id));
      queryClient.setQueryData(assignmentKeys.byCourse(course?.id), (old = []) =>
        old.map(a => a.id === id ? { 
          ...a, 
          active: status, 
          template: plantilla_id !== undefined ? (plantilla_id || "") : a.template, 
          plantilla_id: plantilla_id !== undefined ? (plantilla_id || null) : a.plantilla_id 
        } : a)
      );
      return { previous };
    },
    onSuccess: (_, variables) => {
      if (!variables.status) {
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      }
    },
    onError: (err, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(assignmentKeys.byCourse(course?.id), context.previous);
      }
      logger.error('AssignmentList', "Error updating assignment status", { err });
      setErrorMsg(err.message || "Error al actualizar la tarea");
    },
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ queryKey: assignmentKeys.all });
      if (course?.id && variables?.id) {
        queryClient.removeQueries({ queryKey: ['submission', course.id, variables.id] });
      }
    }
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, plantilla_id }) => {
      if (!course?.id) throw new Error('Missing course id');
      const currentList = queryClient.getQueryData(assignmentKeys.byCourse(course.id)) || [];
      const current = currentList.find(a => a.id === id);
      const status = (!plantilla_id || plantilla_id === "") ? false : (current ? current.active : false);
      const result = await api.post(`/courses/${course.id}/assignments/${id}/toggle`, {
        activo: status,
        plantilla_id: plantilla_id || null,
        variables: []
      });
      if (!result.exito) throw new Error(result.mensaje || 'Error updating template');
      return result;
    },
    onMutate: async ({ id, plantilla_id }) => {
      await queryClient.cancelQueries({ queryKey: assignmentKeys.all });
      const previous = queryClient.getQueryData(assignmentKeys.byCourse(course?.id));
      queryClient.setQueryData(assignmentKeys.byCourse(course?.id), (old = []) =>
        old.map(a => {
          if (a.id === id) {
            const isRemoving = !plantilla_id || plantilla_id === "";
            return { 
              ...a, 
              template: plantilla_id || "", 
              plantilla_id: plantilla_id || null,
              active: isRemoving ? false : a.active 
            };
          }
          return a;
        })
      );
      return { previous };
    },
    onError: (err, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(assignmentKeys.byCourse(course?.id), context.previous);
      }
      logger.error('AssignmentList', "Error updating assignment template", { err });
      setErrorMsg(err.message || "Error al asignar la plantilla");
    },
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ queryKey: assignmentKeys.all });
      if (course?.id && variables?.id && (!variables.plantilla_id || variables.plantilla_id === "")) {
        queryClient.removeQueries({ queryKey: ['submission', course.id, variables.id] });
      }
    }
  });

  const handleTemplateChange = useCallback((id, plantilla_id) => {
    updateTemplateMutation.mutate({ id, plantilla_id });
  }, [updateTemplateMutation]);

  const handleToggle = useCallback((assignment) => {
    setSelectedAssignment(assignment);
    if (assignment.active) {
      setShowDeactivateModal(true);
    } else {
      setShowActivateModal(true);
    }
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowDeactivateModal(false);
    setShowActivateModal(false);
    setSelectedAssignment(null);
  }, []);

  const handleConfirmDeactivate = useCallback(() => {
    if (selectedAssignment) {
      updateMutation.mutate({ id: selectedAssignment.id, status: false, plantilla_id: selectedAssignment.plantilla_id });
    }
    setShowDeactivateModal(false);
    setSelectedAssignment(null);
  }, [selectedAssignment, updateMutation]);

  const handleConfirmActivate = useCallback(() => {
    if (selectedAssignment) {
      updateMutation.mutate({ id: selectedAssignment.id, status: true, plantilla_id: selectedAssignment.plantilla_id });
    }
    setShowActivateModal(false);
    setSelectedAssignment(null);
  }, [selectedAssignment, updateMutation]);

  return {
    assignments,
    loading,
    showDeactivateModal,
    showActivateModal,
    selectedAssignment,
    showToast,
    setShowToast,
    errorMsg,
    setErrorMsg,
    fetchAssignments: refetch,
    isSyncing: isFetching || updateMutation.isPending || updateTemplateMutation.isPending,
    isError,
    queryError: error,
    handleToggle,
    handleCloseModal,
    handleConfirmDeactivate,
    handleConfirmActivate,
    handleTemplateChange,
  };
}
