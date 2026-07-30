import styles from './Spinner.module.css';

export default function Spinner({ size = 'md', label = 'Cargando...', className = '' }) {
  return (
    <div className={`${styles.wrapper} ${className}`} role="status" aria-live="polite">
      <span className={`${styles.spinner} ${styles[size]}`} />
      <span className="sr-only">{label}</span>
    </div>
  );
}
