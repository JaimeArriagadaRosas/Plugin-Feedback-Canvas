import styles from '../TemplateManagement.module.css';

export default function TemplateList({ templates, loading, onEdit, onDelete, onRequestDuplicate }) {
  if (!loading && templates.length === 0) {
    return <div className={styles.emptyState}>No se encontraron plantillas.</div>;
  }

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.th}>NOMBRE DE PLANTILLA</th>
            <th className={styles.th} style={{ width: "100px" }}>RANGOS</th>
            <th className={styles.th} style={{ width: "150px" }}>ACCIONES</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 5 }).map((_, idx) => (
              <tr key={`skel-${idx}`}>
                <td className={styles.td}><div className={`${styles.skeletonCell} ${styles.skeletonCellLong}`} /></td>
                <td className={styles.td}><div className={`${styles.skeletonCell} ${styles.skeletonCellShort}`} /></td>
                <td className={styles.td}><div className={`${styles.skeletonCell} ${styles.skeletonCellMedium}`} /></td>
              </tr>
            ))
          ) : (
            templates.map(template => (
              <tr key={template.id}>
                <td className={styles.td}>
                  <button 
                    className={styles.templateNameBtn}
                    onClick={() => onEdit(template)}
                  >
                    {template.name}
                  </button>
                </td>
                <td className={styles.td}>{template.ranges}</td>
                <td className={styles.td}>
                  <button className={styles.actionIcon} onClick={() => onEdit(template)} title="Editar">📝</button>
                  <button className={styles.actionIcon} onClick={() => onDelete(template)} title="Eliminar">🗑️</button>
                  <button className={styles.actionIcon} onClick={() => onRequestDuplicate(template)} title="Duplicar">📋</button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
