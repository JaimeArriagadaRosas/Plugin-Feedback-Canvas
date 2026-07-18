import styles from './Avatar.module.css';

export default function Avatar({ name, size = 'md', className = '', ...props }) {
  const initials = name
    ? name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '?';

  return (
    <div className={`${styles.avatar} ${styles[size]} ${className}`} aria-hidden="true" {...props}>
      <span className={styles.initials}>{initials}</span>
    </div>
  );
}
