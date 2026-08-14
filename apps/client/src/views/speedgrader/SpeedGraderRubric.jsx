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
      setToastMessage("No rubric associated with this assignment");
      setToastType('info');
      setShowToast(true);
    }
  };

  const handleSimulateClick = () => {
    if (!courseId || !studentId) {
      setToastMessage("Cannot analyze: missing student data.");
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
      <button className={styles.actionBtn} onClick={handleRubricClick}>■ Rubric</button>
      <button className={styles.actionBtn} onClick={onShowHistory}>View History</button>
      <button className={styles.actionBtn} onClick={handleSimulateClick}>
        Analyze Trajectory
      </button>
    </div>
  );
}
