import styles from './Card.module.css';

export default function Card({
  children,
  title,
  headerActions,
  footer,
  className = '',
  ...props
}) {
  return (
    <div className={`${styles.card} ${className}`} {...props}>
      {(title || headerActions) && (
        <div className={styles.header}>
          {title && <h3 className={styles.title}>{title}</h3>}
          {headerActions && <div className={styles.actions}>{headerActions}</div>}
        </div>
      )}
      <div className={styles.body}>{children}</div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
  );
}
