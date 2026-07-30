import React from 'react';
import Modal from '../../components/atoms/Modal';
import styles from './RubricModal.module.css';

export default function RubricModal({ rubric, onClose }) {
  const totalPoints = rubric?.reduce((acc, curr) => acc + (curr.points || 0), 0) || 0;

  return (
    <Modal
      isOpen={!!rubric}
      onClose={onClose}
      title="Rúbrica de la Tarea"
      className={styles.rubricModal}
    >
      <div className={styles.rubricContainer}>
        <div className={styles.rubricHeader}>
          <span className={styles.totalText}>Puntaje Total Posible:</span>
          <span className={styles.totalPoints}>{totalPoints} pts</span>
        </div>
        
        <div className={styles.criteriaList}>
          {rubric?.map((criterion) => (
            <div key={criterion.id} className={styles.criterionCard}>
              <div className={styles.criterionHeader}>
                <h4 className={styles.criterionTitle}>{criterion.description}</h4>
                <span className={styles.criterionPoints}>{criterion.points} pts</span>
              </div>
              {criterion.comments && (
                <p className={styles.criterionComments}>{criterion.comments}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
