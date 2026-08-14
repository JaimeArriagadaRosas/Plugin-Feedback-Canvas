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
        
        // Automatically adjust endpoint if possible, based on selected model
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
    ? [{ value: '', label: 'Loading models...' }]
    : availableModels.length > 0 
      ? availableModels.map(m => ({ value: m.id, label: m.name }))
      : [{ value: '', label: 'No models available' }];

  return (
    <div className={styles.tab}>
      {validationError && <Alert type="error" message={validationError} />}
      {saveSuccess && <Alert type="success" message="Configuration saved successfully. The new parameters were applied to the AI engine." />}

      <div className={styles.row}>
        <div className={styles.col}>
          <label className={styles.label}>Change Language Model</label>
          {service === 'otros' ? (
            <Input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Ex: llama3-70b-8192 or mistral:latest"
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
          <label className={styles.label}>Temperature (0.0 to 2.0)</label>
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
          <label className={styles.label}>Maximum Length (Tokens: 1 to 4096)</label>
          <Input
            type="number"
            value={maxLength}
            onChange={(e) => setMaxLength(e.target.value)}
          />
        </div>
        <div className={styles.col}>
          <label className={styles.label}>AI Provider Endpoint</label>
          <Input
            type="text"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            disabled={service !== 'otros'}
            placeholder={service === 'otros' ? "Ex: http://localhost:11434/v1" : ""}
            helperText={service !== 'otros' ? "The endpoint is automatically managed for official services." : "Base URL for OpenAI-like API"}
          />
        </div>
      </div>

    </div>
  );
}
