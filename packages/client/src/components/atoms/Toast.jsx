import { useEffect, useRef } from 'react';
import styles from './Toast.module.css';

export default function Toast({
  message,
  type = 'info',
  duration = 4000,
  onClose,
  className = '',
}) {
  const timerRef = useRef(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      onClose?.();
    }, duration);

    return () => clearTimeout(timerRef.current);
  }, [duration, onClose]);

  return (
    <div className={`${styles.toast} ${styles[type]} ${className}`} role="status" aria-live="polite">
      <span className={styles.icon} aria-hidden="true">
        {type === 'success' && '✅'}
        {type === 'error' && '⚠️'}
        {type === 'info' && 'ℹ️'}
      </span>
      <span className={styles.message}>{message}</span>
      <button type="button" className={styles.close} onClick={onClose} aria-label="Cerrar notificación">
        ×
      </button>
    </div>
  );
}
