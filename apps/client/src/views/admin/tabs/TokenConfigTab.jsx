import Input from '../../../components/atoms/Input';
import Select from '../../../components/atoms/Select';
import Alert from '../../../components/atoms/Alert';
import styles from './TokenConfigTab.module.css';

export default function TokenConfigTab({
  service,
  setService,
  apiKey,
  setApiKey,
  tokenValidationError,
  tokenSaveSuccess,
  configuredProviders = [],
}) {

  const formatProviders = (providers) => {
    if (!providers || providers.length === 0) return 'None configured';
    const names = {
      openai: 'OpenAI',
      anthropic: 'Claude',
      gemini: 'Gemini',
      otros: 'Other (Custom)'
    };
    return providers.map(p => names[p] || p).join(', ');
  };

  const isConfigured = configuredProviders.includes(service);

  return (
    <div className={styles.tab}>
      {tokenValidationError && <Alert type="error" message={tokenValidationError} />}
      {tokenSaveSuccess && (
        <Alert type="success" message={`Token saved successfully. The API key for ${service} has been updated.`} />
      )}

      <div className={styles.row}>
        <div className={styles.col}>
          <label className={styles.label}>Change AI Service</label>
          <Select
            value={service}
            onChange={(e) => setService(e.target.value)}
            options={[
              { value: 'openai', label: 'OpenAI' },
              { value: 'anthropic', label: 'Claude (Anthropic)' },
              { value: 'gemini', label: 'Gemini (Google)' },
              { value: 'otros', label: 'Other (Custom/Ollama)' },
            ]}
          />
        </div>
        <div className={styles.col}>
          <label className={styles.label}>Enter New API Key or Token</label>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-........................"
            helperText="Existing tokens are not displayed. Enter a new one to update."
          />
        </div>
      </div>


      <div className={styles.infoBox}>
        <div className={styles.infoRow}>
          <strong>Encrypted Stored Tokens:</strong>{' '}
          {configuredProviders.length > 0 ? (
            <span className={styles.successText}>✔ Yes ({formatProviders(configuredProviders)})</span>
          ) : (
            <span style={{ color: '#666' }}>None configured</span>
          )}
        </div>
        <div className={styles.infoBoxInner}>
          <strong>{service} Token Status:</strong>{' '}
          {isConfigured ? (
            <span className={styles.successText}>Active, Encrypted</span>
          ) : (
            <span style={{ color: '#d32f2f' }}>Not configured</span>
          )}
        </div>
      </div>

    </div>
  );
}
