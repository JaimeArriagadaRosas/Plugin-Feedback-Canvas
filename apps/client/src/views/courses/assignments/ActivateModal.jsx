import { useCallback } from 'react';
import Modal from '../../../components/atoms/Modal';
import Button from '../../../components/atoms/Button';
import { useButtonLogger } from '../../../hooks/useButtonLogger';
import styles from './DeactivateModal.module.css';

export default function ActivateModal({ assignment, isOpen, onClose, onConfirm }) {
  const logConfirm = useButtonLogger();
  const logCancel = useButtonLogger();

  const handleConfirm = useCallback(
    async (e) => {
      await logConfirm('ASSIGNMENT_ACTIVATE_CONFIRM', () => onConfirm?.())(e);
    },
    [onConfirm, logConfirm]
  );

  const handleCancel = useCallback(
    async (e) => {
      await logCancel('ASSIGNMENT_ACTIVATE_CANCEL', () => onClose?.())(e);
    },
    [onClose, logCancel]
  );

  if (!assignment) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleCancel} title="Confirm Plugin Activation">
      <div className={styles.body}>
        <p>
          Are you sure you want to activate the feedback plugin for the assignment: <strong>"{assignment.name}"</strong>?
        </p>
        <p className={styles.note}>
          <strong>Note:</strong> A template has already been selected for this assignment. All student submissions without generated feedback will no longer receive one automatically. No new submissions will trigger feedback until reactivated. Confirmation is required according to the requirement.
        </p>
      </div>
      <div className={styles.footer}>
        <Button variant="secondary" onClick={handleCancel}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleConfirm}>
          Confirm
        </Button>
      </div>
    </Modal>
  );
}