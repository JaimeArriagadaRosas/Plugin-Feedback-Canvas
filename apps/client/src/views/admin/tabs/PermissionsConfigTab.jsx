import styles from '../AdminPanel.module.css';
import PermissionsTable from '../../../modules/permissions/components/PermissionsTable';

export default function PermissionsConfigTab() {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Gestión Dinámica de Roles</h2>
      <p className={styles.description}>
        Modifica dinámicamente los permisos por rol limitando funcionalidades.
      </p>
      
      <PermissionsTable />
    </div>
  );
}
