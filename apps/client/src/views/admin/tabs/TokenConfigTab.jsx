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
  customEndpoint,
  setCustomEndpoint,
}) {

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
      
      {service === 'otros' && (
        <div className={styles.row}>
          <div className={styles.col}>
            <label className={styles.label}>Endpoint Personalizado (URL base)</label>
            <Input
              type="text"
              value={customEndpoint}
              onChange={(e) => setCustomEndpoint(e.target.value)}
              placeholder="Ej: http://localhost:11434/v1"
              helperText="URL base para la API tipo OpenAI"
            />
          </div>
        </div>
      )}

      <div className={styles.infoBox}>
        <div className={styles.infoRow}>
          <strong>Tokens Almacenados Cifrados:</strong> <span className={styles.successText}>✔ Sí (OpenAI, Claude, Gemini, Otros)</span>
        </div>
        <div className={styles.infoBoxInner}>
          <strong>Estado de Token {service}:</strong> Activo, Cifrado
        </div>
      </div>

    </div>
  );
}
