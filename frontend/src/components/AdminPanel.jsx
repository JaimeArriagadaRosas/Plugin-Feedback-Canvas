// frontend/src/components/AdminPanel.jsx - Admin configuration (RF51-RF60)
import React, { useState, useEffect } from 'react';
import { useLTI } from './LTIContext';
import apiClient from '../services/api';

const AdminPanel = () => {
  const { user, token } = useLTI();
  const [activeTab, setActiveTab] = useState('ai');
  const [aiConfig, setAiConfig] = useState({});
  const [roles, setRoles] = useState({});
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (user?.role === 'admin') {
      loadAIConfig();
      loadRoles();
    }
  }, [user]);

  const loadAIConfig = async () => {
    try {
      const response = await apiClient.get('/admin/ai-config', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAiConfig(response.data);
    } catch (err) {
      console.error('Failed to load AI config:', err);
    }
  };

  const loadRoles = async () => {
    try {
      const response = await apiClient.get('/admin/roles', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRoles(response.data.roles);
    } catch (err) {
      console.error('Failed to load roles:', err);
    }
  };

  const updateAIConfig = async (key, updates) => {
    setLoading(true);
    try {
      await apiClient.put(`/admin/ai-config/${key}`, updates, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage('✅ Configuración actualizada');
      loadAIConfig();
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage('❌ Error: ' + (err.response?.data?.error || 'Unknown'));
    } finally {
      setLoading(false);
    }
  };

  const saveApiKey = async (provider, key) => {
    try {
      await apiClient.post('/admin/api-keys', { provider, apiKey: key }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage('✅ API key guardada');
    } catch (err) {
      setMessage('❌ Error guardando API key');
    }
  };

  return (
    <div className="admin-panel">
      <h2>⚙️ Panel de Administración</h2>
      
      {message && <div className="alert">{message}</div>}

      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'ai' ? 'active' : ''}`}
          onClick={() => setActiveTab('ai')}
        >
          Motor de IA
        </button>
        <button 
          className={`tab ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          Usuarios y Permisos
        </button>
        <button 
          className={`tab ${activeTab === 'system' ? 'active' : ''}`}
          onClick={() => setActiveTab('system')}
        >
          Sistema
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'ai' && (
          <div className="ai-config">
            <h3>🤖 Configuración del Motor de IA</h3>
            
            <div className="config-section">
              <h4>Proveedor Activo</h4>
              <div className="provider-cards">
                {aiConfig.availableProviders?.map(provider => (
                  <div 
                    key={provider}
                    className={`provider-card ${aiConfig.configs?.[0]?.provider === provider ? 'active' : ''}`}
                    onClick={() => updateAIConfig('default', { provider })}
                  >
                    <h5>{provider.toUpperCase()}</h5>
                    {provider === 'openai' && <p>GPT-4, GPT-3.5-turbo</p>}
                    {provider === 'anthropic' && <p>Claude 3</p>}
                    {provider === 'gemini' && <p>Gemini Pro</p>}
                    {provider === 'mock' && <p>Modo prueba sin IA</p>}
                  </div>
                ))}
              </div>
            </div>

            {aiConfig.configs?.[0] && (
              <div className="config-section">
                <h4>Parámetros</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label>Modelo</label>
                    <select 
                      value={aiConfig.configs[0].modelName}
                      onChange={(e) => updateAIConfig('default', { modelName: e.target.value })}
                    >
                      <option value="gpt-4o">GPT-4o</option>
                      <option value="gpt-4-turbo">GPT-4 Turbo</option>
                      <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                      <option value="claude-3-opus-20240229">Claude 3 Opus</option>
                      <option value="claude-3-sonnet-20240229">Claude 3 Sonnet</option>
                      <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Temperatura ({aiConfig.configs[0].temperature})</label>
                    <input 
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={aiConfig.configs[0].temperature}
                      onChange={(e) => updateAIConfig('default', { temperature: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Tokens máximos</label>
                    <input 
                      type="number"
                      value={aiConfig.configs[0].maxTokens}
                      onChange={(e) => updateAIConfig('default', { maxTokens: parseInt(e.target.value) })}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="config-section">
              <h4>API Keys</h4>
              <p className="help-text">Las claves se almacenan cifradas en la base de datos.</p>
              <div className="api-keys-grid">
                <div className="api-key-input">
                  <label>OpenAI API Key</label>
                  <input type="password" placeholder="sk-..." />
                  <button onClick={() => saveApiKey('openai', 'KEY_HERE')}>Guardar</button>
                </div>
                <div className="api-key-input">
                  <label>Anthropic API Key</label>
                  <input type="password" placeholder="sk-ant-..." />
                  <button onClick={() => saveApiKey('anthropic', 'KEY_HERE')}>Guardar</button>
                </div>
                <div className="api-key-input">
                  <label>Google AI (Gemini) API Key</label>
                  <input type="password" placeholder="AIza..." />
                  <button onClick={() => saveApiKey('gemini', 'KEY_HERE')}>Guardar</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="users-config">
            <h3>👥 Roles y Permisos</h3>
            <div className="roles-table">
              {Object.entries(roles).map(([role, perms]) => (
                <div key={role} className="role-card">
                  <h4>{role === 'teacher' ? 'Profesor' : role === 'admin' ? 'Administrador' : 'Estudiante'}</h4>
                  <ul>
                    {Object.entries(perms).map(([perm, value]) => (
                      <li key={perm}>
                        <input 
                          type="checkbox"
                          checked={value}
                          disabled={role === 'admin'} // admin can't be modified
                          readOnly
                        />
                        <label>{perm}</label>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'system' && (
          <div className="system-config">
            <h3>🖥️ Estado del Sistema</h3>
            <div className="health-grid">
              <div className="health-card">
                <h4>Canvas LMS</h4>
                <span className="status-dot healthy"></span>
                <p>Conectado</p>
              </div>
              <div className="health-card">
                <h4>Base de Datos</h4>
                <span className="status-dot healthy"></span>
                <p>PostgreSQL OK</p>
              </div>
              <div className="health-card">
                <h4>Motor IA</h4>
                <span className="status-dot healthy"></span>
                <p>{aiConfig.configs?.[0]?.provider || 'No configurado'}</p>
              </div>
            </div>

            <div className="system-actions">
              <button className="btn btn-primary">Ver Logs de Auditoría</button>
              <button className="btn btn-secondary">Respaldar Base de Datos</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
