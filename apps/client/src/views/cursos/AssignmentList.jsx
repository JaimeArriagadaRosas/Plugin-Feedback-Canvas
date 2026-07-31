import { useCallback, useState, useEffect } from 'react';
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
    setShowToast,
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
    handleTemplateChange,
  } = useAssignmentList(course);

  const displayError = errorMsg || (isError ? queryError?.message || "Error al cargar/sincronizar las tareas" : null);

  const handleSync = useCallback(() => {
    setShowToast(true);
    logClick('ASSIGNMENT_LIST_SYNC', fetchAssignments)();
    setTimeout(() => setShowToast(false), 3000);
  }, [logClick, fetchAssignments, setShowToast]);

  const handleBack = useCallback(
    () => logClick('ASSIGNMENT_LIST_BACK', onBack)(),
    [logClick, onBack]
  );

  const handleNext = useCallback(
    () => logClick('ASSIGNMENT_LIST_NEXT', () => {
      const activeAssignments = assignments.filter(a => a.active);
      if (activeAssignments.length === 0) {
        setErrorMsg("Debe activar el plugin IA para al menos una tarea antes de continuar.");
        return;
      }
      onNext?.(assignments.length ? assignments[0].id : null);
    })(),
    [logClick, onNext, assignments, setErrorMsg]
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
          <AssignmentTable 
            assignments={assignments} 
            onToggle={handleToggle} 
            onTemplateChange={handleTemplateChange}
            onError={(msg) => setErrorMsg(msg)}
            loading={loading} 
          />
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


      {displayError && (
        <div className={styles.toast} style={{ backgroundColor: '#e74c3c', color: 'white', cursor: 'pointer' }} onClick={() => setErrorMsg(null)}>
          <span style={{ fontSize: 18 }}>&#x26A0;</span>
          <span>{displayError}</span>
        </div>
      )}

      {showToast && (
        <div className={styles.toast} style={{ cursor: 'pointer' }} onClick={() => setShowToast(false)}>
          <span style={{ color: 'var(--color-primary)', fontSize: 18 }}>&#x2139;</span>
          <span>
            Sincronizando configuración...
          </span>
        </div>
      )}
    </div>
  );
}
