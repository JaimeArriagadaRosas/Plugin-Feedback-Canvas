import styles from './Alert.module.css';

export default function Alert({ type = 'info', message, className = '' }) {
  return (
    <div className={`${styles.alert} ${styles[type]} ${className}`} role="alert">
      <span className={styles.icon} aria-hidden="true">
        {type === 'success' && '✅'}
        {type === 'error' && '⚠️'}
        {type === 'warning' && '⚡'}
        {type === 'info' && 'ℹ️'}
      </span>
      <span className={styles.message}>{message}</span>
    </div>
  );
}
