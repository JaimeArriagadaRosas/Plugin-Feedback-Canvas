import { useCallback, useEffect } from 'react';
import { useButtonLogger } from '../../hooks/useButtonLogger';
import { useAdminConfig } from './hooks/useAdminConfig';
import { api } from '../../api';
import ConfigHeader from './organisms/ConfigHeader';
import ConfigFooter from './organisms/ConfigFooter';
import ModelConfigTab from './tabs/ModelConfigTab';
import TokenConfigTab from './tabs/TokenConfigTab';
import PermissionsConfigTab from './tabs/PermissionsConfigTab';
import StatsTab from './tabs/StatsTab';
import AuditLogTab from './tabs/AuditLogTab';
import VariablesGlobalView from './tabs/VariablesGlobalView';
import AdminTabs from './AdminTabs';
import RequirePermission from '../../components/atoms/RequirePermission';
import styles from './AdminPanel.module.css';

export default function AdminPanel({ onExit }) {
  const config = useAdminConfig();
  const logSave = useButtonLogger();
  const logDiscard = useButtonLogger();

  useEffect(() => {
    // Proactive ping to ensure the admin has an OAuth token
    api.get('/courses').catch(() => { /* ignore other errors */ });
  }, []);

  const handleSave = useCallback(
    async (e) => {
      await logSave('ADMIN_PANEL_SAVE', () => config.handleSave())(e);
    },
    [config.handleSave, logSave]
  );

  const handleDiscard = useCallback(
    async (e) => {
      await logDiscard('ADMIN_PANEL_DISCARD', () => {
        config.resetMotor();
        config.resetTokens();
      })(e);
    },
    [config.resetMotor, config.resetTokens, logDiscard]
  );

  return (
    <RequirePermission 
      permission="config_llm" 
      fallback={<div className={styles.wrapper} style={{ padding: '2rem', textAlign: 'center' }}><h2>You do not have permission to access the system configuration.</h2></div>}
    >
      <div className={styles.wrapper}>
        <ConfigHeader title="ADMINISTRATION PANEL" onExit={onExit} activeTab={config.activeTab} />

      <main className={styles.main}>
        <AdminTabs activeTab={config.activeTab} setActiveTab={config.setActiveTab} />

        {config.activeTab === 'RF55' && (
          <ModelConfigTab
            service={config.service}
            model={config.model}
            setModel={config.setModel}
            temperature={config.temperature}
            setTemperature={config.setTemperature}
            maxLength={config.maxLength}
            setMaxLength={config.setMaxLength}
            endpoint={config.endpoint}
            setEndpoint={config.setEndpoint}
            validationError={config.validationError}
            saveSuccess={config.saveSuccess}
            availableModels={config.availableModels}
            isLoadingModels={config.isLoadingModels}
          />
        )}

        {config.activeTab === 'RF56' && (
          <TokenConfigTab
            service={config.service}
            setService={config.setService}
            apiKey={config.apiKey}
            setApiKey={config.setApiKey}
            tokenValidationError={config.tokenValidationError}
            tokenSaveSuccess={config.tokenSaveSuccess}
            configuredProviders={config.configuredProviders}
          />
        )}

        {config.activeTab === 'RF06' && <VariablesGlobalView />}

        {config.activeTab === 'RF52' && <PermissionsConfigTab />}
        
        {config.activeTab === 'reports' && <StatsTab />}

        {config.activeTab === 'audit_logs' && <AuditLogTab />}
      </main>

      {['RF55', 'RF56'].includes(config.activeTab) && (
        <ConfigFooter 
          onSave={handleSave} 
          onDiscard={handleDiscard} 
          saveLabel={config.activeTab === 'RF56' ? 'Sync Token' : 'Update Engine'}
        />
      )}
    </div>
    </RequirePermission>
  );
}
