import React, { useState, useEffect } from 'react';
import { api } from '../../../api';
import Toast from '../../../components/atoms/Toast';
import styles from './VariablesGlobalView.module.css';

export default function VariablesGlobalView() {
  const [variables, setVariables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [formData, setFormData] = useState({ name: '', desc: '' });
  const [submitting, setSubmitting] = useState(false);
  const [variableToDelete, setVariableToDelete] = useState(null);

  useEffect(() => {
    fetchVariables();
  }, []);

  const fetchVariables = async () => {
    setLoading(true);
    try {
      // Usamos el endpoint global de variables
      const res = await api.get('/global-variables');
      setVariables(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error(err);
      setToast({ message: 'Error loading global variables.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.desc.trim()) {
      setToast({ message: 'Both fields are required.', type: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: formData.name,
        desc: formData.desc
      };
      await api.post('/global-variables', payload);
      setToast({ message: 'Variable created successfully.', type: 'success' });
      setFormData({ name: '', desc: '' }); // limpiar formulario
      fetchVariables(); // refrescar lista
    } catch (err) {
      console.error(err);
      setToast({ message: err.response?.data?.error || 'Error creating variable.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!variableToDelete) return;
    
    try {
      await api.del(`/global-variables/${variableToDelete.id}`);
      setToast({ message: 'Variable deleted successfully.', type: 'success' });
      fetchVariables(); // refrescar lista
    } catch (err) {
      console.error(err);
      setToast({ message: err.response?.data?.error || 'Error deleting variable.', type: 'error' });
    } finally {
      setVariableToDelete(null);
    }
  };

  return (
    <div className={styles.container}>
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}

      {variableToDelete && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>Delete variable?</h3>
            <p>Are you sure you want to delete the variable <strong>{variableToDelete.name}</strong>? This action cannot be undone and teachers will no longer be able to use it in their prompts.</p>
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setVariableToDelete(null)}>Cancel</button>
              <button className={styles.confirmBtn} onClick={confirmDelete}>Confirm</button>
            </div>
          </div>
        </div>
      )}
      
      <div className={styles.header}>
        <h2>CUSTOMIZATION VARIABLES MANAGEMENT</h2>
        <p>Manage globally available variables for prompt construction.</p>
      </div>

      <div className={styles.content}>
        <div className={styles.formCard}>
          <h3>ADD NEW CUSTOMIZATION VARIABLE</h3>
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formGroup}>
              <label>Variable Name (Unique)</label>
              <input 
                type="text" 
                name="name" 
                placeholder="{{new_variable}}" 
                value={formData.name}
                onChange={handleInputChange}
                disabled={submitting}
              />
              <small>Example: {'{{asistencia_porcentaje}}'}</small>
            </div>
            <div className={styles.formGroup}>
              <label>Description and Source</label>
              <input 
                type="text" 
                name="desc" 
                placeholder="Clear description of what this variable represents." 
                value={formData.desc}
                onChange={handleInputChange}
                disabled={submitting}
              />
              <small>Example: Student attendance percentage (Source: UNIDA API)</small>
            </div>
            <div className={styles.actions}>
              <button type="submit" className={styles.submitBtn} disabled={submitting}>
                {submitting ? 'Creating...' : 'New Variable'}
              </button>
            </div>
          </form>
        </div>

        <div className={styles.listCard}>
          <h3>LIST OF EXISTING VARIABLES</h3>
          {loading ? (
            <p>Loading variables...</p>
          ) : (
            <div className={styles.tableContainer}>
              <table className={styles.variablesTable}>
                <thead>
                  <tr>
                    <th>Variable Name</th>
                    <th>Description</th>
                    <th style={{ width: '100px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {variables.map((v) => (
                    <tr key={v.id}>
                      <td><strong>{v.name}</strong></td>
                      <td>{v.desc}</td>
                      <td style={{ textAlign: 'center' }}>
                        {v.isCustom ? (
                          <button 
                            className={styles.deleteBtn} 
                            onClick={() => setVariableToDelete(v)}
                            title="Delete variable"
                          >
                            🗑️
                          </button>
                        ) : (
                          <span className={styles.systemBadge}>System</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {variables.length === 0 && (
                    <tr>
                      <td colSpan="3" style={{textAlign: 'center'}}>No variables configured.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
