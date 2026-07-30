import styles from './Table.module.css';

export default function Table({
  children,
  caption,
  className = '',
  ...props
}) {
  return (
    <div className={`${styles.wrapper} ${className}`} {...props}>
      {caption && <caption className={styles.caption}>{caption}</caption>}
      <table className={styles.table}>{children}</table>
    </div>
  );
}

Table.Head = function Head({ children, className = '' }) {
  return <thead className={`${styles.head} ${className}`}>{children}</thead>;
};

Table.Body = function Body({ children, className = '' }) {
  return <tbody className={className}>{children}</tbody>;
};

Table.Row = function Row({ children, className = '', ...props }) {
  return <tr className={className} {...props}>{children}</tr>;
};

Table.Cell = function Cell({ children, header = false, className = '', ...props }) {
  const Tag = header ? 'th' : 'td';
  return (
    <Tag className={`${styles.cell} ${header ? styles.cellHeader : ''} ${className}`} scope={header ? 'col' : undefined} {...props}>
      {children}
    </Tag>
  );
};
