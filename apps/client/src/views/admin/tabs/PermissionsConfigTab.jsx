import styles from '../AdminPanel.module.css';
import PermissionsTable from '../../../modules/permissions/components/PermissionsTable';

export default function PermissionsConfigTab() {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Dynamic Role Management</h2>
      <p className={styles.description}>
        Dynamically modify permissions per role by limiting functionalities.
      </p>
      
      <PermissionsTable />
    </div>
  );
}
