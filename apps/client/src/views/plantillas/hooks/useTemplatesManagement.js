import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api';
import { templateKeys, assignmentKeys } from '@/lib/queryKeys';
import logger from '../../../utils/logger';

export function useTemplatesManagement() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: templates = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: templateKeys.all,
    queryFn: async () => {
      const result = await api.get('/templates');
      if (result.exito && result.data) {
        return result.data.map(t => ({
          id: t.id,
          name: t.nombre,
          ranges: 3,
          contenido: t.contenido
        }));
      }
      return [];
    }
  });

  const filteredTemplates = useMemo(() => {
    return templates.filter(t => {
      const label = t.name || t.nombre;
      return label && label.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [templates, searchTerm]);

  const saveMutation = useMutation({
    mutationFn: async (template) => {
      const payload = {
        nombre: template.name,
        contenido: template.contenido || 'Feedback content...'
      };
      if (template.id) {
        return await api.put(`/templates/${template.id}`, payload);
      } else {
        return await api.post('/templates', payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.all });
      queryClient.invalidateQueries({ queryKey: assignmentKeys.all });
    },
    onError: (e) => {
      logger.error('useTemplatesManagement', "Error saving template:", { error: e });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      return await api.del(`/templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.all });
      queryClient.invalidateQueries({ queryKey: assignmentKeys.all });
    },
    onError: (e) => {
      logger.error('useTemplatesManagement', "Error deleting template:", { error: e });
    }
  });

  const saveTemplate = useCallback(async (template) => {
    return await saveMutation.mutateAsync(template);
  }, [saveMutation]);

  const deleteTemplate = useCallback(async (id) => {
    return await deleteMutation.mutateAsync(id);
  }, [deleteMutation]);

  return {
    templates,
    filteredTemplates,
    loading,
    error,
    searchTerm,
    setSearchTerm,
    saveTemplate,
    deleteTemplate,
    fetchTemplates: refetch
  };
}