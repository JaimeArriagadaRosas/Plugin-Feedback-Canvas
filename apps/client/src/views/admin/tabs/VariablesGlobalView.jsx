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

  useEffect(() => {
    fetchVariables();
  }, []);

  const fetchVariables = async () => {
    setLoading(true);
    try {
      // Usamos el endpoint global de variables
      const res = await api.get('/global-variables');
      setVariables(res.data || []);
    } catch (err) {
      console.error(err);
      setToast({ message: 'Error al cargar variables globales.', type: 'error' });
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
      setToast({ message: 'Ambos campos son requeridos.', type: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: formData.name,
        desc: formData.desc
      };
      await api.post('/global-variables', payload);
      setToast({ message: 'Variable creada exitosamente.', type: 'success' });
      setFormData({ name: '', desc: '' }); // limpiar formulario
      fetchVariables(); // refrescar lista
    } catch (err) {
      console.error(err);
      setToast({ message: err.response?.data?.error || 'Error al crear la variable.', type: 'error' });
    } finally {
      setSubmitting(false);
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
      
      <div className={styles.header}>
        <h2>GESTIÓN DE VARIABLES DE PERSONALIZACIÓN</h2>
        <p>Administra las variables disponibles globalmente para la construcción de prompts.</p>
      </div>

      <div className={styles.content}>
        <div className={styles.formCard}>
          <h3>AGREGAR NUEVA VARIABLE DE PERSONALIZACIÓN</h3>
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formGroup}>
              <label>Nombre de la Variable (Único)</label>
              <input 
                type="text" 
                name="name" 
                placeholder="{{nueva_variable}}" 
                value={formData.name}
                onChange={handleInputChange}
                disabled={submitting}
              />
              <small>Ejemplo: {'{{asistencia_porcentaje}}'}</small>
            </div>
            <div className={styles.formGroup}>
              <label>Descripción y Origen</label>
              <input 
                type="text" 
                name="desc" 
                placeholder="Descripción clara de qué representa esta variable." 
                value={formData.desc}
                onChange={handleInputChange}
                disabled={submitting}
              />
              <small>Ejemplo: Porcentaje de asistencia del estudiante (Fuente: API UNIDA)</small>
            </div>
            <div className={styles.actions}>
              <button type="submit" className={styles.submitBtn} disabled={submitting}>
                {submitting ? 'Creando...' : 'Nueva Variable'}
              </button>
            </div>
          </form>
        </div>

        <div className={styles.listCard}>
          <h3>LISTA DE VARIABLES EXISTENTES</h3>
          {loading ? (
            <p>Cargando variables...</p>
          ) : (
            <div className={styles.tableContainer}>
              <table className={styles.variablesTable}>
                <thead>
                  <tr>
                    <th>Nombre de la Variable</th>
                    <th>Descripción</th>
                  </tr>
                </thead>
                <tbody>
                  {variables.map((v) => (
                    <tr key={v.id}>
                      <td><strong>{v.name}</strong></td>
                      <td>{v.desc}</td>
                    </tr>
                  ))}
                  {variables.length === 0 && (
                    <tr>
                      <td colSpan="2" style={{textAlign: 'center'}}>No hay variables configuradas.</td>
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
