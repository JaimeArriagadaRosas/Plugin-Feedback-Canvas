import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { variablesClient } from '../../../services/variablesClient';
import { api } from '../../../api';
import Toast from '../../../components/atoms/Toast';
import styles from './VariablesConfigView.module.css';

// Eliminado MOCKUP_VARIABLES - ahora se carga dinámicamente desde el backend

export default function VariablesConfigView() {
  const location = useLocation();
  const navigate = useNavigate();
  
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  
  const [masterVariables, setMasterVariables] = useState([]);
  const [variables, setVariables] = useState({});
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    // Cargar lista de cursos y variables maestras
    Promise.all([
      api.get('/courses'),
      api.get('/global-variables')
    ]).then(([resCourses, resVars]) => {
      setCourses(resCourses?.data || resCourses || []);
      setMasterVariables(Array.isArray(resVars) ? resVars : (resVars?.data || []));
      const initCourseId = location.state?.course?.id || (resCourses.data?.[0]?.id);
      if (initCourseId) {
        setSelectedCourseId(String(initCourseId));
      }
    }).catch(err => {
      console.error(err);
      setToast({ message: 'Error cargando datos iniciales', type: 'error' });
    }).finally(() => {
      setInitialLoading(false);
    });
  }, [location.state]);

  useEffect(() => {
    if (!selectedCourseId) return;
    setLoading(true);
    
    variablesClient.getCourseVariables(selectedCourseId)
      .then(data => {
        setVariables(data);
      })
      .catch(err => {
        console.error(err);
        setToast({ message: 'Error al cargar la configuración.', type: 'error' });
      })
      .finally(() => setLoading(false));
  }, [selectedCourseId]);

  const handleToggle = (key) => {
    setVariables(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        activa: !prev[key]?.activa
      }
    }));
  };

  const handleWeightChange = (key, value) => {
    const num = parseInt(value, 10) || 0;
    setVariables(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        ponderacion: num
      }
    }));
  };

  const handleSave = async () => {
    if (!selectedCourseId) return;

    const activeVars = Object.values(variables).filter(v => v.activa);
    if (activeVars.length > 0) {
      const total = activeVars.reduce((sum, v) => sum + (v.ponderacion || 0), 0);
      if (total !== 100) {
        setToast({ message: `Error: La suma de ponderaciones activas debe ser 100% (actual: ${total}%).`, type: 'error' });
        return;
      }
    }

    setSaving(true);
    try {
      await variablesClient.saveCourseVariables(selectedCourseId, variables);
      setToast({ message: 'Configuración guardada correctamente.', type: 'success' });
    } catch (err) {
      console.error(err);
      setToast({ message: 'Error al guardar la configuración.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    if (!selectedCourseId) return;
    // Recargar
    setVariables({}); // force re-render
    setLoading(true);
    variablesClient.getCourseVariables(selectedCourseId).then(data => {
      setVariables(data);
      setLoading(false);
    });
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
      <header className={styles.header}>
        <h1>PANEL DE ADMINISTRACIÓN - CONFIGURACIÓN DE VARIABLES</h1>
      </header>

      <div className={styles.filtersSection}>
        <div className={styles.filterBox}>
          <label>Curso:</label>
          <select value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)}>
            <option value="" disabled>Seleccione curso...</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className={styles.actionButtonsTop}>
          <button className={styles.discardTopBtn} onClick={handleDiscard} disabled={saving || loading}>
            Descartar
          </button>
          <button className={styles.syncTopBtn} onClick={handleSave} disabled={saving}>
            Guardar
          </button>
        </div>
      </div>

      <div className={styles.mainContent}>
        <div className={styles.leftPanel}>
          <h2 className={styles.tableTitle}>GESTIÓN DE VARIABLES DEL ESTUDIANTE</h2>
          
          <div className={styles.tableContainer}>
            <table className={styles.variablesTable}>
            <thead>
              <tr>
                <th>Habilitar</th>
                <th>Nombre de la variable</th>
                <th>Descripción granular</th>
                <th style={{ width: '120px' }}>Ponderación (%)</th>
              </tr>
            </thead>
            <tbody>
              {(initialLoading || loading) ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`skeleton-${i}`}>
                    <td className={styles.centerCell}>
                      <div className={styles.skeletonCheckbox}></div>
                    </td>
                    <td><div className={styles.skeletonText}></div></td>
                    <td><div className={styles.skeletonTextLarge}></div></td>
                    <td className={styles.centerCell}>
                      <div className={styles.skeletonInput}></div>
                    </td>
                  </tr>
                ))
              ) : (
                masterVariables.map(v => (
                  <tr key={v.id}>
                    <td className={styles.centerCell}>
                    <input 
                      type="checkbox" 
                      className={styles.largeCheckbox}
                      checked={!!variables[v.id]?.activa}
                      onChange={() => handleToggle(v.id)}
                      disabled={loading}
                    />
                  </td>
                  <td><strong>{v.name.replace(/[{}]/g, '').replace(/_/g, ' ').charAt(0).toUpperCase() + v.name.replace(/[{}]/g, '').replace(/_/g, ' ').slice(1)}</strong></td>
                  <td>{v.desc}</td>
                  <td className={styles.centerCell}>
                    <input 
                      type="number"
                      min="0"
                      max="100"
                      className={styles.weightInput}
                      value={variables[v.id]?.ponderacion || 0}
                      onChange={(e) => handleWeightChange(v.id, e.target.value)}
                      disabled={loading || !variables[v.id]?.activa}
                    />
                  </td>
                </tr>
              )))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan="3" style={{ textAlign: 'right', fontWeight: 'bold' }}>Total Ponderación (activas):</td>
                <td className={styles.centerCell} style={{ fontWeight: 'bold' }}>
                  {Object.values(variables).filter(v => v.activa).reduce((sum, v) => sum + (v.ponderacion || 0), 0)}%
                </td>
              </tr>
            </tfoot>
          </table>
          </div>
        </div>
      </div>
    </div>
  );
}
