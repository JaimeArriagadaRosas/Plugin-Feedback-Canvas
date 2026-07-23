import { useCallback } from 'react';
import { useButtonLogger } from '../../hooks/useButtonLogger';
import { useAssignmentList } from './hooks/useAssignmentList';
import WizardProgress from './WizardProgress';
import AssignmentTable from './assignments/AssignmentTable';
import ActivateModal from './assignments/ActivateModal';
import DeactivateModal from './assignments/DeactivateModal';
import Button from '../../components/atoms/Button';
import styles from './AssignmentList.module.css';

export default function AssignmentList({ course, onBack, onNext }) {
  const logClick = useButtonLogger();
  const {
    assignments,
    loading,
    showDeactivateModal,
    showActivateModal,
    selectedAssignment,
    showToast,
    errorMsg,
    setErrorMsg,
    fetchAssignments,
    isSyncing,
    isError,
    queryError,
    handleToggle,
    handleCloseModal,
    handleConfirmDeactivate,
    handleConfirmActivate,
  } = useAssignmentList(course);

  const displayError = errorMsg || (isError ? queryError?.message || "Error al cargar/sincronizar las tareas" : null);

  const handleSync = useCallback(() => {
    logClick('ASSIGNMENT_LIST_SYNC', fetchAssignments)();
  }, [logClick, fetchAssignments]);

  const handleBack = useCallback(
    () => logClick('ASSIGNMENT_LIST_BACK', onBack)(),
    [logClick, onBack]
  );

  const handleNext = useCallback(
    () => logClick('ASSIGNMENT_LIST_NEXT', () => onNext?.(assignments.length ? assignments[0].id : null))(),
    [logClick, onNext, assignments]
  );

  return (
    <div className={styles.wrapper}>
      <main className={styles.main}>
        <h1 className={styles.pageTitle}>CONFIGURACIÓN - LISTADO DE TAREAS</h1>

        <div className={styles.sectionHeading}>
          <span>TAREAS EVALUABLES CON RÚBRICA ASOCIADA (Curso: {course?.name})</span>
          <Button variant="secondary" onClick={handleSync} className={styles.btnSync}>
            <span>🔄</span> Sincronizar Tareas Ahora
          </Button>
        </div>

        <div className={styles.tableWrapper}>
          <AssignmentTable assignments={assignments} onToggle={handleToggle} loading={loading} />
        </div>
      </main>

      {/* Barra sticky inferior */}
      <div className={styles.stickyBar}>
        <div className={styles.navButtons}>
          <button className={styles.btnBack} onClick={handleBack}>Volver</button>
          <button className={styles.btnNext} onClick={handleNext}>Continuar</button>
        </div>
        <WizardProgress currentStep={1} />
      </div>

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

      {isSyncing && !loading && (
        <div className={styles.toast} style={{ backgroundColor: '#27ae60', color: 'white' }}>
          <span style={{ fontSize: 18 }}>&#x21BB;</span>
          <span>Sincronizando tareas...</span>
        </div>
      )}

      {displayError && (
        <div className={styles.toast} style={{ backgroundColor: '#e74c3c', color: 'white', cursor: 'pointer' }} onClick={() => setErrorMsg(null)}>
          <span style={{ fontSize: 18 }}>&#x26A0;</span>
          <span>{displayError}</span>
        </div>
      )}

      {showToast && (
        <div className={styles.toast}>
          <span style={{ color: 'var(--color-primary)', fontSize: 18 }}>&#x2139;</span>
          <span>
            Estado guardado exitosamente. Sincronizando configuración...
          </span>
        </div>
      )}
    </div>
  );
}
