import React from 'react';
import StarRating from '../../../components/molecules/StarRating';
import styles from './StudentUtilityRating.module.css';

export default function StudentUtilityRating({ rating, onRate, readonly }) {
  return (
    <div className={styles.ratingSection} style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f0f4f7', borderRadius: '8px', border: '1px solid #c7cdd1', textAlign: 'center' }}>
      <div className={styles.ratingLabel} style={{ fontWeight: 'bold', marginBottom: '10px', color: '#2d3b45' }}>
        ¿Qué tan útil te resultó este feedback?
      </div>
      <div className={styles.ratingStars} style={{ display: 'flex', justifyContent: 'center', gap: '5px' }}>
        <StarRating
          value={rating}
          onChange={onRate}
          readonly={readonly}
        />
      </div>
      {readonly && (
        <div className={styles.ratingSaved} style={{ marginTop: '10px', color: '#008000', fontWeight: 'bold' }}>
          ✓ ¡Gracias por tu valoración!
        </div>
      )}
    </div>
  );
}
