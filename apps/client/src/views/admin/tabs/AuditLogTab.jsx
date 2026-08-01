import styles from '../AdminPanel.module.css';
import { useAuditLogs } from '../../../hooks/useAuditLogs';

export default function AuditLogTab() {
  const { logs, loading, error, fetchLogs } = useAuditLogs(50);

  if (loading) return <div>Cargando logs de auditoría...</div>;

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Logs de Auditoría de Seguridad</h2>
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
          disabled={loading}
          style={{ 
            padding: '8px 16px', 
            background: loading ? '#e0e0e0' : '#f5f5f5', 
            border: '1px solid #c7cdd1', 
            borderRadius: '4px', 
            cursor: loading ? 'not-allowed' : 'pointer', 
            fontWeight: 'bold',
            transition: 'background 0.2s ease'
          }}
        >
          {loading ? '⏳ Refrescando...' : '🔄 Refrescar'}
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
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ 
                      background: log.accion.includes('FALLIDA') || log.accion.includes('DENEGADO') ? '#ffebee' : '#e1f5fe', 
                      color: log.accion.includes('FALLIDA') || log.accion.includes('DENEGADO') ? '#d32f2f' : '#0277bd', 
                      padding: '4px 8px', 
                      borderRadius: '6px', 
                      fontSize: '12px', 
                      fontWeight: 'bold',
                      display: 'inline-block'
                    }}>
                      {log.accion.includes('FALLIDA') || log.accion.includes('DENEGADO') ? '⚠️ ' : '🛡️ '} 
                      {log.accion}
                    </span>
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
