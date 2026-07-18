import { useCallback } from 'react';
import Button from '../../../components/atoms/Button';
import Input from '../../../components/atoms/Input';
import Select from '../../../components/atoms/Select';
import Alert from '../../../components/atoms/Alert';
import { useButtonLogger } from '../../../hooks/useButtonLogger';
import styles from './TokenConfigTab.module.css';

export default function TokenConfigTab({
  service,
  setService,
  apiKey,
  setApiKey,
  tokenValidationError,
  tokenSaveSuccess,
  onSave,
}) {
  const logSave = useButtonLogger();

  const handleSave = useCallback(
    async (e) => {
      await logSave('ADMIN_TOKEN_SAVE', () => onSave?.())(e);
    },
    [onSave, logSave]
  );

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
          <strong>Tokens Almacenados Cifrados:</strong> <span className={styles.successText}>✔ Sí (OpenAI, Claude, Gemini)</span>
        </div>
        <div className={styles.infoBoxInner}>
          <strong>Estado de Token {service}:</strong> Activo, Cifrado
        </div>
      </div>

      <div className={styles.actions}>
        <Button variant="primary" onClick={handleSave}>
          Guardar Token
        </Button>
      </div>
    </div>
  );
}
