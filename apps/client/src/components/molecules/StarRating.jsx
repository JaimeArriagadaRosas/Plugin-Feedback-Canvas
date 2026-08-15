import styles from './StarRating.module.css';

export default function StarRating({ value = 0, onChange, readonly = false, className = '' }) {
  return (
    <div className={`${styles.rating} ${className}`} role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={`${styles.star} ${star <= value ? styles.active : ''} ${readonly ? styles.readonly : ''}`}
          onClick={() => !readonly && onChange?.(star)}
          disabled={readonly}
          aria-checked={star === value}
          aria-label={`${star} star${star > 1 ? 's' : ''}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}
