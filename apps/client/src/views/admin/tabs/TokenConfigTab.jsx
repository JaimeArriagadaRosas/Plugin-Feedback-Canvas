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
    if (!providers || providers.length === 0) return 'Ninguno configurado';
    const names = {
      openai: 'OpenAI',
      anthropic: 'Claude',
      gemini: 'Gemini',
      otros: 'Otros (Custom)'
    };
    return providers.map(p => names[p] || p).join(', ');
  };

  const isConfigured = configuredProviders.includes(service);

  return (
    <div className={styles.tab}>
      {tokenValidationError && <Alert type="error" message={tokenValidationError} />}
      {tokenSaveSuccess && (
        <Alert type="success" message={`Token guardado exitosamente. La API key para ${service} ha sido actualizada.`} />
      )}

      <div className={styles.row}>
        <div className={styles.col}>
          <label className={styles.label}>Cambiar de Servicio IA</label>
          <Select
            value={service}
            onChange={(e) => setService(e.target.value)}
            options={[
              { value: 'openai', label: 'OpenAI' },
              { value: 'anthropic', label: 'Claude (Anthropic)' },
              { value: 'gemini', label: 'Gemini (Google)' },
              { value: 'otros', label: 'Otros (Custom/Ollama)' },
            ]}
          />
        </div>
        <div className={styles.col}>
          <label className={styles.label}>Ingresar Nueva Llave API o Token</label>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-........................"
            helperText="Tokens existentes no se muestran. Ingrese uno nuevo para actualizar."
          />
        </div>
      </div>


      <div className={styles.infoBox}>
        <div className={styles.infoRow}>
          <strong>Tokens Almacenados Cifrados:</strong>{' '}
          {configuredProviders.length > 0 ? (
            <span className={styles.successText}>✔ Sí ({formatProviders(configuredProviders)})</span>
          ) : (
            <span style={{ color: '#666' }}>Ninguno configurado</span>
          )}
        </div>
        <div className={styles.infoBoxInner}>
          <strong>Estado de Token {service}:</strong>{' '}
          {isConfigured ? (
            <span className={styles.successText}>Activo, Cifrado</span>
          ) : (
            <span style={{ color: '#d32f2f' }}>No configurado</span>
          )}
        </div>
      </div>

    </div>
  );
}
