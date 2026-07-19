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
        className={`${styles.tabButton} ${activeTab === 'RF46' ? styles.tabActive : ''}`}
        onClick={() => setActiveTab('RF46')}
      >
        Reportes y Métricas
      </button>
      <button
        className={`${styles.tabButton} ${activeTab === 'RF40' ? styles.tabActive : ''}`}
        onClick={() => setActiveTab('RF40')}
      >
        Logs de Auditoría
      </button>
    </div>
  );
}
