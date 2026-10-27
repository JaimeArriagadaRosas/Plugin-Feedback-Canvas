import React, { useCallback } from 'react';
import Button from '../../../components/atoms/Button';
import { useButtonLogger } from '../../../hooks/useButtonLogger';
import styles from './ConfigFooter.module.css';

export default function ConfigFooter({ onSave, onDiscard, saveLabel = 'Sync and Update AI Engine Now' }) {
  const logSave = useButtonLogger();
  const logDiscard = useButtonLogger();

  const handleSave = useCallback(
    async (e) => {
      await logSave('ADMIN_CONFIG_SAVE', () => onSave?.())(e);
    },
    [onSave, logSave]
  );

  const handleDiscard = useCallback(
    async (e) => {
      await logDiscard('ADMIN_CONFIG_DISCARD', () => onDiscard?.())(e);
    },
    [onDiscard, logDiscard]
  );

  return (
    <div className={styles.footer}>
      <Button variant="secondary" onClick={handleDiscard}>
        Discard Changes
      </Button>
      <Button variant="primary" onClick={handleSave}>
        {saveLabel}
      </Button>
    </div>
  );
}
