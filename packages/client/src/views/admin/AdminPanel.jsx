import { useCallback } from 'react';
import { useButtonLogger } from '../../hooks/useButtonLogger';
import { useAdminConfig } from './hooks/useAdminConfig';
import ConfigHeader from './organisms/ConfigHeader';
import ConfigFooter from './organisms/ConfigFooter';
import ModelConfigTab from './tabs/ModelConfigTab';
import TokenConfigTab from './tabs/TokenConfigTab';
import PermissionsConfigTab from './tabs/PermissionsConfigTab';
import StatsTab from './tabs/StatsTab';
import AuditLogTab from './tabs/AuditLogTab';
import AdminTabs from './AdminTabs';
import styles from './AdminPanel.module.css';

export default function AdminPanel({ onExit }) {
  const config = useAdminConfig();
  const logSave = useButtonLogger();
  const logDiscard = useButtonLogger();

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
    <div className={styles.wrapper}>
      <ConfigHeader title="PANEL DE ADMINISTRACIÓN" onExit={onExit} activeTab={config.activeTab} />

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
            onSave={config.handleSaveMotorConfig}
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
            onSave={config.handleSaveTokenConfig}
          />
        )}

        {config.activeTab === 'RF52' && <PermissionsConfigTab />}
        
        {config.activeTab === 'RF46' && <StatsTab />}

        {config.activeTab === 'RF40' && <AuditLogTab />}
      </main>

      <ConfigFooter onSave={handleSave} onDiscard={handleDiscard} />
    </div>
  );
}
