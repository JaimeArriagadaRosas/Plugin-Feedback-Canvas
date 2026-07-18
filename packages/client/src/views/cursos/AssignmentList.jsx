import { useCallback } from 'react';
import { useButtonLogger } from '../../hooks/useButtonLogger';
import { useAssignmentList } from './hooks/useAssignmentList';
import WizardProgress from './WizardProgress';
import StatusFooter from './StatusFooter';
import AssignmentTable from './assignments/AssignmentTable';
import ActivateModal from './assignments/ActivateModal';
import DeactivateModal from './assignments/DeactivateModal';
import Button from '../../components/atoms/Button';
import styles from './AssignmentList.module.css';

export default function AssignmentList({ course, onBack, onNext }) {
  const { logClick } = useButtonLogger();
  const {
    assignments,
    loading,
    showDeactivateModal,
    showActivateModal,
    selectedAssignment,
    showToast,
    fetchAssignments,
    handleToggle,
    handleCloseModal,
    handleConfirmDeactivate,
    handleConfirmActivate,
  } = useAssignmentList(course);

  const handleSync = useCallback(() => {
    logClick('ASSIGNMENT_LIST_SYNC');
    fetchAssignments();
  }, [logClick, fetchAssignments]);

  const handleBack = useCallback(() => {
    logClick('ASSIGNMENT_LIST_BACK');
    onBack?.();
  }, [logClick, onBack]);

  const handleNext = useCallback(() => {
    logClick('ASSIGNMENT_LIST_NEXT');
    onNext?.(assignments.length ? assignments[0].id : null);
  }, [logClick, onNext, assignments]);

  return (
    <div className={styles.wrapper}>
      <main className={styles.main}>
        <h1 className={styles.pageTitle}>CONFIGURACIÓN - LISTADO DE TAREAS</h1>

        <div className={styles.sectionHeading}>
          TAREAS EVALUABLES CON RÚBRICA ASOCIADA (Curso: {course?.name})
        </div>

        <div className={styles.tableWrapper}>
          <AssignmentTable assignments={assignments} onToggle={handleToggle} />
        </div>

        <Button variant="secondary" onClick={handleSync} className={styles.btnSync}>
          <span>🔄</span> Sincronizar Tareas Ahora
        </Button>

        <div className={styles.actions}>
          <Button variant="secondary" onClick={handleBack}>
            Volver a Selección de Curso
          </Button>
          <Button variant="primary" onClick={handleNext}>
            Continuar a Configuración
          </Button>
        </div>

        <WizardProgress currentStep={1} />
      </main>

      <StatusFooter
        lastSync="10:35:12"
        count={assignments.length}
        label="Cantidad de tareas"
        isConnected={true}
      />

      <DeactivateModal
        assignment={selectedAssignment}
        isOpen={showDeactivateModal}
        onClose={handleCloseModal}
        onConfirm={handleConfirmDeactivate}
      />

      <ActivateModal
        assignment={selectedAssignment}
        isOpen={showActivateModal}
        onClose={handleCloseModal}
        onConfirm={handleConfirmActivate}
      />

      {showToast && (
        <div className={styles.toast}>
          <span style={{ color: 'var(--color-primary)', fontSize: 18 }}>ℹ</span>
          <span>
            Estado RF40 guardado: Plugin desactivado para {selectedAssignment?.name}. Sincronizando configuración...
          </span>
        </div>
      )}
    </div>
  );
}
