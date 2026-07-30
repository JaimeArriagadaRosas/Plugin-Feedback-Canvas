import React, { useState } from 'react';
import Toast from '../../components/atoms/Toast';
import styles from './SpeedGraderRubric.module.css';

export default function SpeedGraderRubric({ onShowHistory, onShowTrajectory, grade, hasRubric, onShowRubric, courseId, studentId }) {
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('info');

  const handleRubricClick = () => {
    if (hasRubric) {
      onShowRubric();
    } else {
      setToastMessage("No existe rúbrica asociada a esta tarea");
      setToastType('info');
      setShowToast(true);
    }
  };

  const handleSimulateClick = () => {
    if (!courseId || !studentId) {
      setToastMessage("No se puede analizar: faltan datos del estudiante.");
      setToastType('error');
      setShowToast(true);
      return;
    }
    
    onShowTrajectory();
  };

  return (
    <div className={styles.actionButtons}>
      {showToast && (
        <Toast 
          message={toastMessage} 
          type={toastType} 
          duration={3000} 
          onClose={() => setShowToast(false)} 
        />
      )}
      <button className={styles.actionBtn} onClick={handleRubricClick}>■ Rúbrica</button>
      <button className={styles.actionBtn} onClick={onShowHistory}>Ver Historial</button>
      <button className={styles.actionBtn} onClick={handleSimulateClick}>
        Analizar Trayectoria
      </button>
    </div>
  );
}
