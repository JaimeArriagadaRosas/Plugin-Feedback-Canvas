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

  const { data: assignments = [], isLoading: loading } = useQuery({
    queryKey: ['assignments', course?.id],
    queryFn: async () => {
      if (!course?.id) return [];
      const result = await api.get(`/courses/${course.id}/assignments`);
      if (result.exito && result.data) {
        return result.data.map(a => ({
          id: a.id,
          name: a.name,
          due: a.due_at ? new Date(a.due_at).toLocaleDateString() : 'Sin fecha',
          rubric: true,
          template: a.template || "",
          active: a.active || false
        }));
      }
      return [];
    },
    enabled: !!course?.id,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, variables = [] }) => {
      if (!course?.id) throw new Error('Missing course id');
      const result = await api.post(`/courses/${course.id}/assignments/${id}/toggle`, {
        activo: status,
        plantilla_id: 1,
        variables
      });
      if (!result.exito) throw new Error(result.mensaje || 'Error updating assignment');
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.setQueryData(['assignments', course?.id], (old = []) =>
        old.map(a => a.id === variables.id ? { ...a, active: variables.status } : a)
      );
      if (!variables.status) {
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      }
    },
    onError: (error) => {
      logger.error('AssignmentList', "Error updating assignment status", { error });
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
      updateMutation.mutate({ id: selectedAssignment.id, status: false });
    }
    setShowDeactivateModal(false);
    setSelectedAssignment(null);
  }, [selectedAssignment, updateMutation]);

  const handleConfirmActivate = useCallback((variables) => {
    if (selectedAssignment) {
      updateMutation.mutate({ id: selectedAssignment.id, status: true, variables });
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
    handleToggle,
    handleCloseModal,
    handleConfirmDeactivate,
    handleConfirmActivate,
  };
}
