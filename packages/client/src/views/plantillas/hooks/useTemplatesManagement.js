import { useState, useEffect, useMemo } from 'react';
import { api } from 'shared/api';
import logger from '../../../utils/logger';

export function useTemplatesManagement() {
  const [templates, setTemplates] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTemplates = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.get('/templates');
      if (result.exito && result.data) {
        setTemplates(result.data.map(t => ({
          id: t.id,
          name: t.nombre,
          ranges: 3,
          contenido: t.contenido
        })));
      }
    } catch (e) {
      logger.error('useTemplatesManagement', "Error fetching templates:", { error: e });
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const filteredTemplates = useMemo(() => {
    return templates.filter(t => 
      t.name && t.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [templates, searchTerm]);

  const saveTemplate = async (template) => {
    const payload = {
      nombre: template.name,
      contenido: template.contenido || 'Feedback content...'
    };

    if (template.id) {
      await api.put(`/templates/${template.id}`, payload);
    } else {
      await api.post('/templates', payload);
    }
    await fetchTemplates();
  };

  const deleteTemplate = async (id) => {
    await api.del(`/templates/${id}`);
    setTemplates(prev => prev.filter(t => t.id !== id));
  };

  return {
    templates,
    filteredTemplates,
    loading,
    error,
    searchTerm,
    setSearchTerm,
    saveTemplate,
    deleteTemplate,
    fetchTemplates
  };
}