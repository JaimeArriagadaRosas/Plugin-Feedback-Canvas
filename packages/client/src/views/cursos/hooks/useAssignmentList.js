import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from 'shared/api';
import logger from '../../../utils/logger';

export function useAssignmentList(course) {
  const queryClient = useQueryClient();
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [showToast, setShowToast] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const { data: assignments = [], isLoading: loading, refetch, isFetching, isError, error } = useQuery({
    queryKey: ['assignments', course?.id?.toString()],
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
          active: Boolean(a.active)
        }));
      }
      return [];
    },
    enabled: !!course?.id,
  });

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
    onSuccess: (_, variables) => {
      queryClient.setQueryData(['assignments', course?.id?.toString()], (old = []) =>
        old.map(a => a.id === variables.id ? { ...a, active: variables.status } : a)
      );
      if (!variables.status) {
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      }
    },
    onError: (error) => {
      logger.error('AssignmentList', "Error updating assignment status", { error });
      setErrorMsg(error.message || "Error al actualizar la tarea");
    }
  });

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
    errorMsg,
    setErrorMsg,
    fetchAssignments: refetch,
    isSyncing: isFetching,
    isError,
    queryError: error,
    handleToggle,
    handleCloseModal,
    handleConfirmDeactivate,
    handleConfirmActivate,
  };
}
