import React, { useState, useEffect } from 'react';
import { getPreferences, updatePreferences } from '../services/preferencesApi.js';
import styles from './NotificationPreferencesForm.module.css';

export default function NotificationPreferencesForm({ onClose }) {
  const [metodo, setMetodo] = useState('both');
  const [frecuencia, setFrecuencia] = useState('inmediata');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPrefs = async () => {
      try {
        const data = await getPreferences();
        setMetodo(data.metodo);
        setFrecuencia(data.frecuencia);
      } catch (err) {
        console.warn('No se pudieron cargar las preferencias, usando valores por defecto:', err);
        setMetodo('both');
        setFrecuencia('inmediata');
      } finally {
        setLoading(false);
      }
    };
    fetchPrefs();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await updatePreferences(metodo, frecuencia);
      if (onClose) onClose();
    } catch (err) {
      setError('Error al guardar las preferencias.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className={styles.container}>Cargando...</div>;

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>CONFIGURACIÓN DE NOTIFICACIÓN ESTUDIANTE</h3>
      {error && <div className={styles.error}>{error}</div>}
      <form onSubmit={handleSave} className={styles.form}>
        <div className={styles.columns}>
          <div className={styles.column}>
            <label className={styles.labelTitle}>Elegir Método de Notificación</label>
            <div className={styles.radioGroup}>
              <label className={styles.radioLabel}>
                <input 
                  type="radio" 
                  name="metodo" 
                  value="both" 
                  checked={metodo === 'both'}
                  onChange={(e) => setMetodo(e.target.value)}
                />
                Ambos métodos
              </label>
              <label className={styles.radioLabel}>
                <input 
                  type="radio" 
                  name="metodo" 
                  value="canvas_inapp" 
                  checked={metodo === 'canvas_inapp'}
                  onChange={(e) => setMetodo(e.target.value)}
                />
                Notificación In-app Canvas
              </label>
              <label className={styles.radioLabel}>
                <input 
                  type="radio" 
                  name="metodo" 
                  value="email" 
                  checked={metodo === 'email'}
                  onChange={(e) => setMetodo(e.target.value)}
                />
                Correo Institucional
              </label>
              <label className={styles.radioLabel}>
                <input 
                  type="radio" 
                  name="metodo" 
                  value="none" 
                  checked={metodo === 'none'}
                  onChange={(e) => setMetodo(e.target.value)}
                />
                Sin Notificaciones
              </label>
            </div>
          </div>
          <div className={styles.column}>
            <label className={styles.labelTitle}>Frecuencia de Notificación</label>
            <div className={styles.radioGroup}>
              <label className={styles.radioLabel}>
                <input 
                  type="radio" 
                  name="frecuencia" 
                  value="inmediata" 
                  checked={frecuencia === 'inmediata'}
                  onChange={(e) => setFrecuencia(e.target.value)}
                />
                Inmediata
              </label>
              <label className={styles.radioLabel}>
                <input 
                  type="radio" 
                  name="frecuencia" 
                  value="diario" 
                  checked={frecuencia === 'diario'}
                  onChange={(e) => setFrecuencia(e.target.value)}
                />
                Diario (Resumen)
              </label>
            </div>
          </div>
        </div>
        <div className={styles.actions}>
          <button type="button" onClick={onClose} className={styles.cancelBtn} disabled={saving}>Cancelar</button>
          <button type="submit" className={styles.saveBtn} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  );
}
