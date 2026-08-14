import { useCallback, useState, useEffect } from 'react';
import { usePermissions } from '../../hooks/usePermissions';
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
  const { canEditFeedback } = usePermissions();
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

  const displayError = errorMsg || (isError ? queryError?.message || "Error loading/syncing assignments" : null);

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
      if (!canEditFeedback) {
        setErrorMsg("You do not have permission to edit feedback or advance to Step 3.");
        return;
      }
      const activeAssignments = assignments.filter(a => a.active);
      if (activeAssignments.length === 0) {
        setErrorMsg("You must enable the AI plugin for at least one assignment before continuing.");
        return;
      }
      onNext?.(assignments.length ? assignments[0].id : null);
    })(),
    [logClick, onNext, assignments, setErrorMsg]
  );

  return (
    <div className={styles.wrapper}>
      <main className={styles.main}>
        <h1 className={styles.pageTitle}>CONFIGURATION — ASSIGNMENT LIST</h1>

        <div className={styles.sectionHeading}>
          <span>GRADEABLE ASSIGNMENTS WITH ASSOCIATED RUBRIC (Course: {course?.name})</span>
          <Button variant="secondary" onClick={handleSync} className={styles.btnSync}>
            <span>🔄</span> Sync Assignments Now
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

      {/* Bottom sticky bar */}
      <div className={styles.stickyBar}>
        <div className={styles.navButtons}>
          <button className={styles.btnBack} onClick={handleBack}>Back</button>
          <button 
            className={styles.btnNext} 
            onClick={handleNext}
            disabled={!canEditFeedback}
            title={!canEditFeedback ? "Edit permission disabled" : ""}
          >
            Continue
          </button>
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
            Syncing configuration...
          </span>
        </div>
      )}
    </div>
  );
}
