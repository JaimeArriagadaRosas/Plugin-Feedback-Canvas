// frontend/src/components/TemplateManager.jsx - Template CRUD (RF09-RF15)
import React, { useState, useEffect } from 'react';
import { useLTI } from './LTIContext';
import apiClient from '../services/api';

const TemplateManager = () => {
  const { courseId, token } = useLTI();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [validationStatus, setValidationStatus] = useState(null);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    gradeRange: 'satisfactory',
    minGrade: 4.0,
    maxGrade: 5.9,
    content: '',
    variables: ['nombre_estudiante', 'calificacion', 'promedio_curso']
  });

  useEffect(() => {
    loadTemplates();
    checkCompleteness();
  }, [courseId]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get(
        `/templates?courseId=${courseId}&activeOnly=true`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTemplates(response.data.templates);
    } catch (err) {
      setError(err.response?.data?.error || 'Error cargando plantillas');
    } finally {
      setLoading(false);
    }
  };

  const checkCompleteness = async () => {
    try {
      const response = await apiClient.get(
        `/templates/validate-complete/${courseId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setValidationStatus(response.data);
    } catch (err) {
      console.error('Validation check failed:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const url = editingTemplate ? `/templates/${editingTemplate.id}` : '/templates';
      const method = editingTemplate ? 'PUT' : 'POST';
      
      await apiClient[method.toLowerCase()](url, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setShowForm(false);
      setEditingTemplate(null);
      resetForm();
      loadTemplates();
      checkCompleteness();
    } catch (err) {
      setError(err.response?.data?.error || 'Error guardando plantilla');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (template) => {
    setFormData({
      name: template.name,
      description: template.description,
      gradeRange: template.gradeRange,
      minGrade: template.minGrade,
      maxGrade: template.maxGrade,
      content: template.content,
      variables: template.variables
    });
    setEditingTemplate(template);
    setShowForm(true);
  };

  const handleDuplicate = async (templateId) => {
    const newName = prompt('Nombre para la copia:');
    if (!newName) return;
    
    try {
      await apiClient.post(`/templates/${templateId}/duplicate`, { newName }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      loadTemplates();
    } catch (err) {
      setError('Error duplicando plantilla');
    }
  };

  const handleDelete = async (templateId) => {
    if (!confirm('¿Estás seguro de eliminar esta plantilla?')) return;
    
    try {
      await apiClient.delete(`/templates/${templateId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      loadTemplates();
      checkCompleteness();
    } catch (err) {
      setError(err.response?.data?.error || 'Error eliminando plantilla');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      gradeRange: 'satisfactory',
      minGrade: 4.0,
      maxGrade: 5.9,
      content: '',
      variables: ['nombre_estudiante', 'calificacion', 'promedio_curso']
    });
  };

  const rangeColors = {
    excellent: '#22c55e',
    satisfactory: '#f59e0b',
    needs_improvement: '#ef4444'
  };

  return (
    <div className="template-manager">
      <div className="manager-header">
        <h2>📋 Gestión de Plantillas</h2>
        <div className="header-actions">
          {validationStatus && (
            <span className={`completeness-badge ${validationStatus.isValid ? 'valid' : 'invalid'}`}>
              {validationStatus.isValid ? '✅ Plantillas completas' : `⚠️ Faltan: ${validationStatus.missingRanges.join(', ')}`}
            </span>
          )}
          <button 
            className="btn btn-primary"
            onClick={() => { setShowForm(true); setEditingTemplate(null); resetForm(); }}
          >
            + Nueva Plantilla
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>{editingTemplate ? 'Editar Plantilla' : 'Nueva Plantilla'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Nombre</label>
                <input 
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Rango de calificación</label>
                  <select 
                    value={formData.gradeRange}
                    onChange={(e) => setFormData({...formData, gradeRange: e.target.value})}
                  >
                    <option value="excellent">Excelente (6.0-7.0)</option>
                    <option value="satisfactory">Satisfactorio (4.0-5.9)</option>
                    <option value="needs_improvement">Necesita Mejorar (<4.0)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Calificación mínima</label>
                  <input 
                    type="number"
                    step="0.1"
                    value={formData.minGrade}
                    onChange={(e) => setFormData({...formData, minGrade: parseFloat(e.target.value)})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Calificación máxima</label>
                  <input 
                    type="number"
                    step="0.1"
                    value={formData.maxGrade}
                    onChange={(e) => setFormData({...formData, maxGrade: parseFloat(e.target.value)})}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Contenido (usa {{variable}} para personalización)</label>
                <textarea 
                  value={formData.content}
                  onChange={(e) => setFormData({...formData, content: e.target.value})}
                  rows="6"
                  required
                />
                <small>Variables disponibles: {{nombre_estudiante}}, {{calificacion}}, {{promedio_curso}}, {{historial_previo}}</small>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="templates-grid">
        {loading && !templates.length ? (
          <div className="spinner"></div>
        ) : templates.length === 0 ? (
          <div className="empty-state">
            <p>No hay plantillas creadas aún.</p>
            <button 
              className="btn btn-primary"
              onClick={() => setShowForm(true)}
            >
              Crear primera plantilla
            </button>
          </div>
        ) : (
          templates.map((template) => (
            <div 
              key={template.id} 
              className={`template-card range-${template.gradeRange}`}
              style={{ borderLeftColor: rangeColors[template.gradeRange] }}
            >
              <div className="template-header">
                <h4>{template.name}</h4>
                <span className={`range-indicator ${template.gradeRange}`}>
                  {template.minGrade} - {template.maxGrade}
                </span>
              </div>
              <p className="template-description">{template.description}</p>
              <div className="template-preview">
                <small>{template.content.substring(0, 150)}...</small>
              </div>
              <div className="template-meta">
                <span>Usos: {template.usageCount}</span>
                <span>{template.isSystem ? '🔒 Sistema' : '📝 Personal'}</span>
              </div>
              <div className="template-actions">
                <button 
                  className="btn btn-sm btn-outline"
                  onClick={() => handleEdit(template)}
                >
                  ✏️ Editar
                </button>
                <button 
                  className="btn btn-sm btn-outline"
                  onClick={() => handleDuplicate(template.id)}
                >
                  📋 Duplicar
                </button>
                {!template.isSystem && (
                  <button 
                    className="btn btn-sm btn-danger"
                    onClick={() => handleDelete(template.id)}
                  >
                    🗑️ Eliminar
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TemplateManager;
