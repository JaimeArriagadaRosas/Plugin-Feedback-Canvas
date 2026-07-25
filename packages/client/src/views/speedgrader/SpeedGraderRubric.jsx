import React, { useState } from 'react';
import Toast from '../../components/atoms/Toast';
import styles from './SpeedGraderRubric.module.css';

export default function SpeedGraderRubric({ onShowHistory, grade, hasRubric, onShowRubric }) {
  const [showToast, setShowToast] = useState(false);

  const handleRubricClick = () => {
    if (hasRubric) {
      onShowRubric();
    } else {
      setShowToast(true);
    }
  };

  return (
    <div className={styles.actionButtons}>
      {showToast && (
        <Toast 
          message="No existe rúbrica asociada a esta tarea" 
          type="info" 
          duration={3000} 
          onClose={() => setShowToast(false)} 
        />
      )}
      <button className={styles.actionBtn} onClick={handleRubricClick}>■ Rúbrica</button>
      <button className={styles.actionBtn} onClick={onShowHistory}>Ver Historial</button>
      <button className={styles.actionBtn}>
        Simular Trayectoria: {grade >= 6 ? 'ALTA' : 'BAJA'}
        <span className={styles.trajectoryBadge}>
          {grade >= 6 ? '(Regresión)' : '(Mejora)'}
        </span>
      </button>
    </div>
  );
}
