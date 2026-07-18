import { useCallback } from 'react';
import Button from '../atoms/Button';
import Modal from '../atoms/Modal';
import { useButtonLogger } from '../../hooks/useButtonLogger';

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirmar',
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  confirmVariant = 'primary',
}) {
  const logConfirm = useButtonLogger();
  const logCancel = useButtonLogger();

  const handleConfirm = useCallback(
    async (e) => {
      await logConfirm('CONFIRM_DIALOG_CONFIRM', () => onConfirm?.(e))();
    },
    [logConfirm, onConfirm]
  );

  const handleCancel = useCallback(
    async (e) => {
      await logCancel('CONFIRM_DIALOG_CANCEL', () => onClose?.(e))();
    },
    [logCancel, onClose]
  );

  return (
    <Modal isOpen={isOpen} onClose={handleCancel} title={title}>
      <p style={{ margin: 0, lineHeight: 1.6, color: 'var(--color-text)' }}>{message}</p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
        <Button variant="secondary" onClick={handleCancel}>
          {cancelLabel}
        </Button>
        <Button variant={confirmVariant} onClick={handleConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
