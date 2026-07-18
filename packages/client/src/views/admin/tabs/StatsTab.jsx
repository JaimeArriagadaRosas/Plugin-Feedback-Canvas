import { useState, useEffect } from 'react';
import apiClient from '../../../api/apiClient';
import styles from '../AdminPanel.module.css';
import { useAuth } from '../../context/AuthContext';
import Toast from '../../../components/atoms/Toast';
import logger from '../../../utils/logger';

export default function StatsTab() {
  const [stats, setStats] = useState(null);
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const { courseId } = useAuth();

  // Asumimos que podemos obtener estadísticas globales usando un courseId por defecto o el del contexto
  const courseIdResolved = courseId || '1';

  useEffect(() => {
    fetchStats();
  }, [courseIdResolved]);

  const fetchStats = async () => {
    try {
      const [statsRes, ratingsRes] = await Promise.all([
        apiClient.get(`/stats/course/${courseIdResolved}`),
        apiClient.get(`/stats/ratings/${courseIdResolved}`)
      ]);
      setStats(statsRes.data);
      setRatings(ratingsRes.data || []);
    } catch (err) {
      logger.error('StatsTab', 'Error fetching stats', { error: err });
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Cargando métricas...</div>;

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Reportes y Estadísticas (RF46-RF49)</h2>
      <p className={styles.description}>
        Métricas de uso y utilidad del feedback generado por la IA en el curso {courseIdResolved}.
      </p>

      {stats && (
        <div style={{ display: 'flex', gap: '20px', marginTop: '20px', flexWrap: 'wrap' }}>
          <div style={{ padding: '20px', background: '#f5f5f5', borderRadius: '8px', minWidth: '200px' }}>
            <h3 style={{ margin: '0 0 10px 0' }}>Feedbacks Generados</h3>
            <p style={{ fontSize: '32px', fontWeight: 'bold', margin: '0', color: '#0770a3' }}>{stats.total}</p>
          </div>
          
          <div style={{ padding: '20px', background: '#e6f4ea', borderRadius: '8px', minWidth: '200px' }}>
            <h3 style={{ margin: '0 0 10px 0' }}>Aprobados</h3>
            <p style={{ fontSize: '32px', fontWeight: 'bold', margin: '0', color: '#137333' }}>
              {stats.byStatus['APROBADO'] || 0} ({stats.percentages['APROBADO'] || 0}%)
            </p>
          </div>

          <div style={{ padding: '20px', background: '#fef7e0', borderRadius: '8px', minWidth: '200px' }}>
            <h3 style={{ margin: '0 0 10px 0' }}>Pendientes</h3>
            <p style={{ fontSize: '32px', fontWeight: 'bold', margin: '0', color: '#b06000' }}>
              {stats.byStatus['PENDIENTE'] || 0} ({stats.percentages['PENDIENTE'] || 0}%)
            </p>
          </div>
        </div>
      )}

      <div style={{ marginTop: '30px', display: 'flex', gap: '15px' }}>
        <button 
          onClick={() => setToast({ message: 'Exportando a PDF (en desarrollo)...', type: 'info' })}
          style={{ padding: '10px 20px', background: '#d32f2f', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          📄 Exportar Reporte PDF
        </button>
        <button 
          onClick={() => setToast({ message: 'Exportando a Excel (en desarrollo)...', type: 'info' })}
          style={{ padding: '10px 20px', background: '#1d8348', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          📊 Exportar Datos a Excel
        </button>
      </div>

      <h3 style={{ marginTop: '40px' }}>Utilidad del Feedback (Estudiantes) - Histograma</h3>
      <div style={{ background: '#f9f9f9', padding: '20px', borderRadius: '8px', border: '1px solid #ddd' }}>
        {ratings.length === 0 ? (
          <p>No hay calificaciones registradas.</p>
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
