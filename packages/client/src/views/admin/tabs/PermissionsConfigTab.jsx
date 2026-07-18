import { useState, useEffect } from 'react';
import apiClient from '../../../api/apiClient';
import styles from '../AdminPanel.module.css';
import logger from '../../../utils/logger';

export default function PermissionsConfigTab() {
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    try {
      const res = await apiClient.get('/config/permissions');
      setPermissions(res.data || []);
    } catch (err) {
      logger.error('PermissionsConfigTab', 'Error fetching permissions', { error: err });
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (role, permKey, currentValue) => {
    try {
      const roleData = permissions.find(p => p.rol === role);
      if (!roleData) return;
      const updatedPerms = { ...roleData.permisos, [permKey]: !currentValue };
      await apiClient.put(`/config/permissions/${role}`, updatedPerms);
      fetchPermissions();
    } catch (err) {
      logger.error('PermissionsConfigTab', 'Error updating permissions', { error: err });
    }
  };

  if (loading) return <div>Cargando permisos...</div>;

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Gestión Dinámica de Roles (RF52)</h2>
      <p className={styles.description}>
        Modifica dinámicamente los permisos por rol limitando funcionalidades.
      </p>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
        <thead>
          <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
            <th style={{ padding: '10px', textAlign: 'left' }}>Rol</th>
            <th style={{ padding: '10px' }}>Ver Feedback</th>
            <th style={{ padding: '10px' }}>Editar Feedback</th>
            <th style={{ padding: '10px' }}>Enviar Feedback</th>
            <th style={{ padding: '10px' }}>Configurar LLM</th>
          </tr>
        </thead>
        <tbody>
          {permissions.map((p) => (
            <tr key={p.rol} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '10px', fontWeight: 'bold', textTransform: 'capitalize' }}>{p.rol}</td>
              {['ver_feedback', 'editar_feedback', 'enviar_feedback', 'configurar_llm'].map(permKey => (
                <td key={permKey} style={{ padding: '10px', textAlign: 'center' }}>
                  <input 
                    type="checkbox" 
                    checked={p.permisos[permKey] || false}
                    onChange={() => handleToggle(p.rol, permKey, p.permisos[permKey])}
                    disabled={p.rol === 'admin'} // Evitar bloquear al admin
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
