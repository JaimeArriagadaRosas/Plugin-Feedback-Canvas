import styles from './AdminPanel.module.css';

export default function AdminTabs({ activeTab, setActiveTab }) {
  return (
    <div className={styles.tabs}>
      <button
        className={`${styles.tabButton} ${activeTab === 'RF56' ? styles.tabActive : ''}`}
        onClick={() => setActiveTab('RF56')}
      >
        Gestión de Tokens IA
      </button>
      <button
        className={`${styles.tabButton} ${activeTab === 'RF06' ? styles.tabActive : ''}`}
        onClick={() => setActiveTab('RF06')}
      >
        Variables Globales
      </button>
      <button
        className={`${styles.tabButton} ${activeTab === 'RF55' ? styles.tabActive : ''}`}
        onClick={() => setActiveTab('RF55')}
      >
        Configuración Motor IA
      </button>
      <button
        className={`${styles.tabButton} ${activeTab === 'RF52' ? styles.tabActive : ''}`}
        onClick={() => setActiveTab('RF52')}
      >
        Roles y Permisos
      </button>
      <button
        className={`${styles.tabButton} ${activeTab === 'reports' ? styles.tabActive : ''}`}
        onClick={() => setActiveTab('reports')}
      >
        Reportes y Métricas
      </button>
      <button
        className={`${styles.tabButton} ${activeTab === 'audit_logs' ? styles.tabActive : ''}`}
        onClick={() => setActiveTab('audit_logs')}
      >
        Logs de Auditoría
      </button>
    </div>
  );
}
