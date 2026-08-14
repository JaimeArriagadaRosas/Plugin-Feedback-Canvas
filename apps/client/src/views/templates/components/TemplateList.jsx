import styles from '../TemplateManagement.module.css';

const SKELETON_KEYS = ['skel-tmpl-1', 'skel-tmpl-2', 'skel-tmpl-3', 'skel-tmpl-4', 'skel-tmpl-5'];

export default function TemplateList({ templates, loading, onEdit, onDelete, onRequestDuplicate }) {
  if (!loading && templates.length === 0) {
    return <div className={styles.emptyState}>No templates found.</div>;
  }

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.th}>TEMPLATE NAME</th>
            <th className={styles.th} style={{ width: "100px" }}>RANGES</th>
            <th className={styles.th} style={{ width: "150px" }}>ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            SKELETON_KEYS.map((key) => (
              <tr key={key}>
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
                  <button className={styles.actionIcon} onClick={() => onEdit(template)} title="Edit">📝</button>
                  <button className={styles.actionIcon} onClick={() => onDelete(template)} title="Delete">🗑️</button>
                  <button className={styles.actionIcon} onClick={() => onRequestDuplicate(template)} title="Duplicate">📋</button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
