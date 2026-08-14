import { useState, useEffect } from 'react';
import { StatsService } from '../../../services/StatsService';
import styles from '../AdminPanel.module.css';
import Toast from '../../../components/atoms/Toast';
import logger from '../../../utils/logger';

export default function StatsTab() {
  const [stats, setStats] = useState(null);
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const data = await StatsService.fetchStats();
      setStats(data.stats);
      setRatings(data.ratings);
    } catch (err) {
      logger.error('StatsTab', 'Error fetching stats', { error: err });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format) => {
    try {
      setToast({ message: `Generating ${format.toUpperCase()}...`, type: 'info' });
      await StatsService.exportReport(format);
      setToast({ message: `${format.toUpperCase()} exported successfully.`, type: 'success' });
    } catch (error) {
      logger.error('StatsTab', `Error exporting ${format}`, { error });
      setToast({ message: `Error exporting ${format.toUpperCase()}`, type: 'error' });
    }
  };

  if (loading) return <div>Loading metrics...</div>;

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Reports and Statistics</h2>
      <p className={styles.description}>
        Usage and utility metrics for AI-generated feedback across all courses.
      </p>

      {stats && (
        <div style={{ display: 'flex', gap: '20px', marginTop: '20px', flexWrap: 'wrap' }}>
          <div style={{ padding: '20px', background: '#f5f5f5', borderRadius: '8px', minWidth: '200px' }}>
            <h3 style={{ margin: '0 0 10px 0' }}>Feedback Generated</h3>
            <p style={{ fontSize: '32px', fontWeight: 'bold', margin: '0', color: '#0770a3' }}>{stats.total}</p>
          </div>
          
          <div style={{ padding: '20px', background: '#e6f4ea', borderRadius: '8px', minWidth: '200px' }}>
            <h3 style={{ margin: '0 0 10px 0' }}>Approved</h3>
            <p style={{ fontSize: '32px', fontWeight: 'bold', margin: '0', color: '#137333' }}>
              {stats.byStatus['APROBADO'] || 0} ({stats.percentages['APROBADO'] || 0}%)
            </p>
          </div>

          <div style={{ padding: '20px', background: '#fef7e0', borderRadius: '8px', minWidth: '200px' }}>
            <h3 style={{ margin: '0 0 10px 0' }}>Pending</h3>
            <p style={{ fontSize: '32px', fontWeight: 'bold', margin: '0', color: '#b06000' }}>
              {stats.byStatus['PENDIENTE'] || 0} ({stats.percentages['PENDIENTE'] || 0}%)
            </p>
          </div>

          <div style={{ padding: '20px', background: '#ebf5fb', borderRadius: '8px', minWidth: '200px' }}>
            <h3 style={{ margin: '0 0 10px 0' }}>Edited</h3>
            <p style={{ fontSize: '32px', fontWeight: 'bold', margin: '0', color: '#1a5276' }}>
              {stats.byStatus['EDITADO'] || 0} ({stats.percentages['EDITADO'] || 0}%)
            </p>
          </div>
        </div>
      )}

      <div style={{ marginTop: '30px', display: 'flex', gap: '15px' }}>
        <button 
          onClick={() => handleExport('pdf')}
          style={{ padding: '10px 20px', background: '#d32f2f', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          📄 Export PDF Report
        </button>
        <button 
          onClick={() => handleExport('excel')}
          style={{ padding: '10px 20px', background: '#1d8348', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          📊 Export Data to Excel
        </button>
      </div>

      <h3 style={{ marginTop: '40px' }}>Feedback Utility (Students) — Histogram</h3>
      <div style={{ background: '#f9f9f9', padding: '20px', borderRadius: '8px', border: '1px solid #ddd' }}>
        {ratings.length === 0 ? (
          <p>No ratings recorded.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {ratings.sort((a, b) => b.rating - a.rating).map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ width: '100px', fontWeight: 'bold' }}>{'⭐'.repeat(r.rating)}</div>
                <div style={{ flex: 1, height: '20px', background: '#e0e0e0', borderRadius: '10px', overflow: 'hidden', marginLeft: '10px' }}>
                  <div style={{ width: `${(r.count / Math.max(...ratings.map(x => x.count))) * 100}%`, height: '100%', background: '#0770a3' }}></div>
                </div>
                <div style={{ width: '40px', textAlign: 'right', fontWeight: 'bold', color: '#555' }}>{r.count}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
