import styles from './AuditInfo.module.css';

export default function AuditInfo() {
  return (
    <div className={styles.card}>
      <div className={styles.header}>REGISTRO DE AUDITORÍA</div>
      <div className={styles.body}>
        <table className={styles.table}>
          <tbody>
            <tr className={styles.row}>
              <td className={styles.label}>Última Modificación</td>
              <td className={styles.value}>14/05/2026 18:10:05</td>
            </tr>
            <tr>
              <td className={styles.label}>Autor de la Versión</td>
              <td className={styles.value}>Dr. Elena Ramirez (ID: ER-88)</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
