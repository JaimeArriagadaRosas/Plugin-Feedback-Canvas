import styles from './AdminPanel.module.css';

export default function AdminTabs({ activeTab, setActiveTab }) {
  return (
    <div className={styles.tabs}>
      <button
        className={`${styles.tabButton} ${activeTab === 'RF56' ? styles.tabActive : ''}`}
        onClick={() => setActiveTab('RF56')}
      >
        AI Token Management
      </button>
      <button
        className={`${styles.tabButton} ${activeTab === 'RF06' ? styles.tabActive : ''}`}
        onClick={() => setActiveTab('RF06')}
      >
        Global Variables
      </button>
      <button
        className={`${styles.tabButton} ${activeTab === 'RF55' ? styles.tabActive : ''}`}
        onClick={() => setActiveTab('RF55')}
      >
        AI Engine Configuration
      </button>
      <button
        className={`${styles.tabButton} ${activeTab === 'RF52' ? styles.tabActive : ''}`}
        onClick={() => setActiveTab('RF52')}
      >
        Roles and Permissions
      </button>
      <button
        className={`${styles.tabButton} ${activeTab === 'reports' ? styles.tabActive : ''}`}
        onClick={() => setActiveTab('reports')}
      >
        Reports and Metrics
      </button>
      <button
        className={`${styles.tabButton} ${activeTab === 'audit_logs' ? styles.tabActive : ''}`}
        onClick={() => setActiveTab('audit_logs')}
      >
        Audit Logs
      </button>
    </div>
  );
}
