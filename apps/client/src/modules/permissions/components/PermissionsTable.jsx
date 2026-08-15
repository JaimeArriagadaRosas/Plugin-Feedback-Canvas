import { useState, useEffect } from 'react';
import apiClient from '../../../api/apiClient';
import styles from '../../../views/admin/AdminPanel.module.css';
import logger from '../../../utils/logger';
import Toast from '../../../components/atoms/Toast';

// Utility to translate backend keys to friendly labels
const PERMISSION_LABELS = {
  view_feedback: 'View Feedback',
  edit_feedback: 'Edit Feedback',
  submit_feedback: 'Submit Feedback',
  config_llm: 'Configure LLM'
};

export default function PermissionsTable() {
  const [matrix, setMatrix] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    try {
      const res = await apiClient.get('/config/permissions');
      setMatrix(res.data || []);
    } catch (err) {
      logger.error('PermissionsTable', 'Error fetching permissions matrix', { error: err });
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (role, permKey, currentValue) => {
    try {
      // Get the current overrides being shown and calculate the update
      const roleData = matrix.find(m => m.rol === role);
      if (!roleData) return;

      const currentOverrides = {};
      Object.keys(roleData.permisos).forEach(k => {
        currentOverrides[k] = roleData.permisos[k].value;
      });
      
      const newPermissions = {
        ...currentOverrides,
        [permKey]: !currentValue
      };

      await apiClient.put(`/config/permissions/${role}`, newPermissions);
      fetchPermissions();
      
      setToastMessage('Permissions updated successfully');
      setToastType('success');
      setShowToast(true);
    } catch (err) {
      logger.error('PermissionsTable', 'Error updating permissions', { error: err });
      setToastMessage('Error updating permissions');
      setToastType('error');
      setShowToast(true);
    }
  };

  if (loading) return <div>Loading permissions matrix...</div>;
  if (!matrix || matrix.length === 0) return <div>No permissions data available.</div>;

  // Dynamically extract columns based on the keys returned by the backend
  // Use the first role as a reference for the columns
  const permissionKeys = Object.keys(matrix[0]?.permisos || {});

  return (
    <div style={{ position: 'relative' }}>
      {showToast && (
        <Toast 
          message={toastMessage} 
          type={toastType} 
          duration={3000} 
          onClose={() => setShowToast(false)} 
        />
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
      <thead>
        <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
          <th style={{ padding: '10px', textAlign: 'left' }}>Role</th>
          {permissionKeys.map(key => (
            <th key={key} style={{ padding: '10px' }}>
              {PERMISSION_LABELS[key] || key}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {matrix.map((row) => (
          <tr key={row.rol} style={{ borderBottom: '1px solid #eee' }}>
            <td style={{ padding: '10px', fontWeight: 'bold', textTransform: 'capitalize' }}>
              {row.rol}
            </td>
            {permissionKeys.map(permKey => {
              const permData = row.permisos[permKey] || { value: false, isMutable: false };
              return (
                <td key={permKey} style={{ padding: '10px', textAlign: 'center' }}>
                  <input 
                    type="checkbox" 
                    checked={permData.value}
                    onChange={() => handleToggle(row.rol, permKey, permData.value)}
                    disabled={!permData.isMutable} 
                    title={!permData.isMutable ? "This permission is locked by the system for this role" : "Click to change"}
                  />
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}
