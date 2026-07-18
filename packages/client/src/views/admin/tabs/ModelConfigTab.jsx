import { useCallback } from 'react';
import Button from '../../../components/atoms/Button';
import Input from '../../../components/atoms/Input';
import Select from '../../../components/atoms/Select';
import Alert from '../../../components/atoms/Alert';
import { useButtonLogger } from '../../../hooks/useButtonLogger';
import styles from './ModelConfigTab.module.css';

export default function ModelConfigTab({
  service,
  model,
  setModel,
  temperature,
  setTemperature,
  maxLength,
  setMaxLength,
  endpoint,
  setEndpoint,
  validationError,
  saveSuccess,
  onSave,
}) {
  const logModelChange = useButtonLogger();
  const logSave = useButtonLogger();

  const handleModelChange = useCallback(
    async (e) => {
      const newModel = e.target.value;
      await logModelChange('ADMIN_MODEL_CHANGE', () => {
        setModel(newModel);
        if (newModel === "GPT-4o" || newModel === "GPT-3.5 Turbo") {
          setEndpoint("https://api.openai.com/v1/chat/completions");
        } else if (newModel === "Claude 3.5 Opus") {
          setEndpoint("https://api.anthropic.com/v1/messages");
        } else if (newModel === "gemini-1.5-pro" || newModel === "gemini-1.5-flash") {
          setEndpoint(`https://generativelanguage.googleapis.com/v1beta/models/${newModel}`);
        } else if (newModel === "Gemini 1.5 Pro") {
          setEndpoint("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro");
        }
      })(e);
    },
    [setModel, setEndpoint, logModelChange]
  );

  let availableOptions = [];
  if (service === 'gemini') {
    availableOptions = [
      { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
      { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    ];
  } else if (service === 'openai') {
    availableOptions = [
      { value: 'GPT-4o', label: 'GPT-4o' },
      { value: 'GPT-3.5 Turbo', label: 'GPT-3.5 Turbo' },
    ];
  } else if (service === 'anthropic') {
    availableOptions = [
      { value: 'Claude 3.5 Opus', label: 'Claude 3.5 Opus' },
    ];
  } else {
    availableOptions = [
      { value: 'GPT-4o', label: 'GPT-4o' },
      { value: 'Claude 3.5 Opus', label: 'Claude 3.5 Opus' },
      { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
    ];
  }

  const handleSave = useCallback(
    async (e) => {
      await logSave('ADMIN_MODEL_SAVE', () => onSave?.())(e);
    },
    [onSave, logSave]
  );

  return (
    <div className={styles.tab}>
      {validationError && <Alert type="error" message={validationError} />}
      {saveSuccess && <Alert type="success" message="Configuración guardada exitosamente. Los nuevos parámetros se aplicaron al motor de IA." />}

      <div className={styles.row}>
        <div className={styles.col}>
          <label className={styles.label}>Cambiar de Modelo de Lenguaje</label>
          <Select
            value={model}
            onChange={handleModelChange}
            options={availableOptions}
          />
        </div>
        <div className={styles.col}>
          <label className={styles.label}>Temperatura (0.0 a 2.0)</label>
          <Input
            type="number"
            step="0.1"
            value={temperature}
            onChange={(e) => setTemperature(e.target.value)}
          />
        </div>
      </div>

      <div className={styles.row}>
        <div className={styles.col}>
          <label className={styles.label}>Longitud Máxima (Tokens: 1 a 4096)</label>
          <Input
            type="number"
            value={maxLength}
            onChange={(e) => setMaxLength(e.target.value)}
          />
        </div>
        <div className={styles.col}>
          <label className={styles.label}>Endpoint del Proveedor de IA</label>
          <Input
            type="text"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
          />
        </div>
      </div>

      <div className={styles.actions}>
        <Button variant="primary" onClick={handleSave}>
          Guardar Configuración
        </Button>
      </div>
    </div>
  );
}
