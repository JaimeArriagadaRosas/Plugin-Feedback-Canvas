import { useCallback } from 'react';
import Modal from '../../../components/atoms/Modal';
import Button from '../../../components/atoms/Button';
import { useButtonLogger } from '../../../hooks/useButtonLogger';
import styles from './DeactivateModal.module.css';

export default function DeactivateModal({ assignment, isOpen, onClose, onConfirm }) {
  const logConfirm = useButtonLogger();
  const logCancel = useButtonLogger();

  const handleConfirm = useCallback(
    async (e) => {
      await logConfirm('ASSIGNMENT_DEACTIVATE_CONFIRM', () => onConfirm?.())(e);
    },
    [onConfirm, logConfirm]
  );

  const handleCancel = useCallback(
    async (e) => {
      await logCancel('ASSIGNMENT_DEACTIVATE_CANCEL', () => onClose?.())(e);
    },
    [onClose, logCancel]
  );

  if (!assignment) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleCancel} title="Confirmar Desactivación del Plugin">
      <div className={styles.body}>
        <p>
          ¿Está seguro de que desea desactivar el plugin de feedback para la tarea: <strong>"{assignment.name}"</strong>?
        </p>
        <p className={styles.note}>
          <strong>Nota:</strong> Ya se ha seleccionado una plantilla para esta tarea. Todas las entregas de estudiantes sin un feedback generado ya no recibirán uno automáticamente. Ninguna nueva entrega activará un feedback hasta que se reactive.
        </p>
      </div>
      <div className={styles.footer}>
        <Button variant="secondary" onClick={handleCancel}>
          Cancelar
        </Button>
        <Button variant="danger" onClick={handleConfirm}>
          Confirmar
        </Button>
      </div>
    </Modal>
  );
}
