import styles from './Badge.module.css';

export default function Badge({ children, variant = 'default', className = '', ...props }) {
  return (
    <span className={`${styles.badge} ${styles[variant]} ${className}`} {...props}>
      {children}
    </span>
  );
}
