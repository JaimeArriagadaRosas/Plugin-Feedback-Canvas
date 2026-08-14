import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { variablesClient } from '../../../services/variablesClient';
import { api } from '../../../api';
import Toast from '../../../components/atoms/Toast';
import styles from './VariablesConfigView.module.css';

// MOCKUP_VARIABLES removed - now loaded dynamically from the backend

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
    // Load course list and master variables
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
      setToast({ message: 'Error loading initial data', type: 'error' });
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
        setToast({ message: 'Error loading configuration.', type: 'error' });
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
        setToast({ message: `Error: The sum of active weights must be 100% (current: ${total}%).`, type: 'error' });
        return;
      }
    }

    setSaving(true);
    try {
      await variablesClient.saveCourseVariables(selectedCourseId, variables);
      setToast({ message: 'Configuration saved successfully.', type: 'success' });
    } catch (err) {
      console.error(err);
      setToast({ message: 'Error saving configuration.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    if (!selectedCourseId) return;
    // Reload
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
        <h1>ADMINISTRATION PANEL — VARIABLE CONFIGURATION</h1>
      </header>

      <div className={styles.filtersSection}>
        <div className={styles.filterBox}>
          <label>Course:</label>
          <select value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)}>
            <option value="" disabled>Select course...</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className={styles.actionButtonsTop}>
          <button className={styles.discardTopBtn} onClick={handleDiscard} disabled={saving || loading}>
            Discard
          </button>
          <button className={styles.syncTopBtn} onClick={handleSave} disabled={saving}>
            Save
          </button>
        </div>
      </div>

      <div className={styles.mainContent}>
        <div className={styles.leftPanel}>
          <h2 className={styles.tableTitle}>STUDENT VARIABLE MANAGEMENT</h2>
          
          <div className={styles.tableContainer}>
            <table className={styles.variablesTable}>
            <thead>
              <tr>
                <th>Enable</th>
                <th>Variable Name</th>
                <th>Granular Description</th>
                <th style={{ width: '120px' }}>Weight (%)</th>
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
                <td colSpan="3" style={{ textAlign: 'right', fontWeight: 'bold' }}>Total Weight (active):</td>
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
