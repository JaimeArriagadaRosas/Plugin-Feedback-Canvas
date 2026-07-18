import { useState, useEffect } from 'react';
import apiClient from '../../../api/apiClient';
import styles from '../AdminPanel.module.css';
import logger from '../../../utils/logger';

export default function AuditLogTab() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      // Pidiendo los últimos 50 logs por defecto
      const response = await apiClient.get('/audit/logs?limit=50');
      if (response.data?.exito) {
        setLogs(response.data.data || []);
      } else {
        throw new Error(response.data?.error?.mensaje || 'Error desconocido');
      }
    } catch (err) {
      logger.error('AuditLogTab', 'Error fetching audit logs', { error: err });
      setError('No se pudieron cargar los logs de auditoría.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Cargando logs de auditoría...</div>;

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Logs de Auditoría de Seguridad (RF40)</h2>
      <p className={styles.description}>
        Visualiza el registro de accesos no autorizados, cambios de configuración y otras acciones de seguridad relevantes.
      </p>

      {error && (
        <div style={{ color: '#d32f2f', background: '#ffebee', padding: '10px', borderRadius: '4px', marginBottom: '15px' }}>
          {error}
        </div>
      )}

      <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
        <button 
          onClick={fetchLogs}
          style={{ padding: '8px 16px', background: '#f5f5f5', border: '1px solid #c7cdd1', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          🔄 Refrescar
        </button>
      </div>

      <div style={{ background: '#fff', border: '1px solid #c7cdd1', borderRadius: '8px', overflowX: 'auto' }}>
        {logs.length === 0 ? (
          <p style={{ padding: '20px', textAlign: 'center', color: '#666' }}>No hay registros de auditoría disponibles.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead style={{ background: '#f5f5f5', borderBottom: '2px solid #c7cdd1' }}>
              <tr>
                <th style={{ padding: '12px 16px', fontWeight: 'bold' }}>Fecha</th>
                <th style={{ padding: '12px 16px', fontWeight: 'bold' }}>Usuario</th>
                <th style={{ padding: '12px 16px', fontWeight: 'bold' }}>Acción</th>
                <th style={{ padding: '12px 16px', fontWeight: 'bold' }}>Detalle / IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', color: '#555' }}>
                    {new Date(log.fecha).toLocaleString()}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ background: '#e1f5fe', color: '#0277bd', padding: '2px 6px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                      {log.usuario_id || 'SISTEMA'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: '500' }}>
                    {log.accion}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#666' }}>
                    <div>{log.detalle}</div>
                    {log.ip_address && <div style={{ fontSize: '11px', color: '#aaa', marginTop: '4px' }}>IP: {log.ip_address}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
