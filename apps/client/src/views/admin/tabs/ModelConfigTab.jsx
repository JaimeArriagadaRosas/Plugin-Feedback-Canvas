import { useCallback } from 'react';
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
  availableModels,
  isLoadingModels,
}) {
  const logModelChange = useButtonLogger();

  const handleModelChange = useCallback(
    async (e) => {
      let newModel = e.target.value;

      await logModelChange('ADMIN_MODEL_CHANGE', () => {
        setModel(newModel);
        
        // Ajustar endpoint automáticamente si es posible, según el modelo seleccionado
        if (newModel.startsWith("gpt-") || newModel.startsWith("o1") || newModel.startsWith("o3")) {
          setEndpoint("https://api.openai.com/v1/chat/completions");
        } else if (newModel.startsWith("claude-")) {
          setEndpoint("https://api.anthropic.com/v1/messages");
        } else if (newModel.startsWith("gemini-")) {
          setEndpoint(`https://generativelanguage.googleapis.com/v1beta/models/${newModel}`);
        }
      })(e);
    },
    [setModel, setEndpoint, logModelChange, service]
  );

  const availableOptions = isLoadingModels
    ? [{ value: '', label: 'Cargando modelos...' }]
    : availableModels.length > 0 
      ? availableModels.map(m => ({ value: m.id, label: m.name }))
      : [{ value: '', label: 'Sin modelos disponibles' }];

  return (
    <div className={styles.tab}>
      {validationError && <Alert type="error" message={validationError} />}
      {saveSuccess && <Alert type="success" message="Configuración guardada exitosamente. Los nuevos parámetros se aplicaron al motor de IA." />}

      <div className={styles.row}>
        <div className={styles.col}>
          <label className={styles.label}>Cambiar de Modelo de Lenguaje</label>
          {service === 'otros' ? (
            <Input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Ej: llama3-70b-8192 o mistral:latest"
            />
          ) : (
            <Select
              value={model}
              onChange={handleModelChange}
              options={availableOptions}
              disabled={isLoadingModels || availableModels.length === 0}
            />
          )}
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

    </div>
  );
}
