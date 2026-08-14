import { useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useButtonLogger } from '../../hooks/useButtonLogger';
import ReviewFilters from './review/ReviewFilters';
import FeedbackTable from './review/FeedbackTable';
import ApprovalModal from './ApprovalModal';
import EditFeedbackModal from './EditFeedbackModal';
import { useAuth } from '../context/AuthContext';
import { useFeedbackReview } from './review/useFeedbackReview';
import Toast from '../../components/atoms/Toast';
import ConfirmDialog from '../../components/molecules/ConfirmDialog';
import PendingFeedbacksIndicator from './review/PendingFeedbacksIndicator';
import { usePermissions } from '../../hooks/usePermissions';
import RequirePermission from '../../components/atoms/RequirePermission';
import styles from './FeedbackReviewPanel.module.css';

export default function FeedbackReviewPanel() {
  const logClick = useButtonLogger();
  const { canSubmitFeedback } = usePermissions();
  const { selectedCourse: globalSelectedCourse } = useAuth();
  const initialCourse = globalSelectedCourse?.id;
  const {
    feedbacks,
    loading,
    filteredFeedbacks,
    selectedCourse,
    setSelectedCourse,
    selectedAssignment,
    setSelectedAssignment,
    coursesList,
    assignmentsList,
    showApprovalModal,
    setShowApprovalModal,
    showEditModal,
    setShowEditModal,
    activeFeedback,
    setActiveFeedback,
    handleApprove,
    handleReject,
    handleEditSave,
    handleBulkApprove,
    confirmBulkApprove,
    cancelBulkApprove,
    pendingBulkApproval,
    handleExportExcel,
    toastMessage,
    setToastMessage,
    selectedIds,
    toggleSelection,
    toggleAllSelection,
    isApprovalSubmitting,
  } = useFeedbackReview({ initialSelectedCourse: initialCourse ? String(initialCourse) : undefined });

  const handleReview = useCallback((row) => {
    logClick('FEEDBACK_REVIEW_OPEN_DETAIL', () => {
      setActiveFeedback(row);
      setShowApprovalModal(true);
    })();
  }, [logClick, setActiveFeedback, setShowApprovalModal]);

  const handleEdit = useCallback((row) => {
    logClick('FEEDBACK_REVIEW_EDIT', () => {
      setActiveFeedback(row);
      setShowEditModal(true);
    })();
  }, [logClick, setActiveFeedback, setShowEditModal]);

  const handleClearFilters = useCallback(() => {
    setSelectedCourse('All');
    setSelectedAssignment('All');
  }, [setSelectedCourse, setSelectedAssignment]);

  const handleCloseModal = useCallback(() => {
    setShowApprovalModal(false);
    setShowEditModal(false);
    setActiveFeedback(null);
  }, [setShowApprovalModal, setShowEditModal, setActiveFeedback]);

  return (
    <RequirePermission 
      permission="view_feedback" 
      fallback={<div className={styles.panel} style={{ padding: '2rem', textAlign: 'center' }}><h2>Functionality disabled by the administrator.</h2></div>}
    >
      <div className={styles.panel}>
        <header className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <PendingFeedbacksIndicator courseId={selectedCourse} />
          <h1 className={styles.title}>FEEDBACK REVIEW</h1>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.exportButton}
            onClick={logClick('FEEDBACK_REVIEW_BULK_APPROVE', handleBulkApprove)}
            style={{ marginRight: '10px', backgroundColor: canSubmitFeedback ? '#0374B5' : '#ccc', color: '#fff', borderColor: canSubmitFeedback ? '#0374B5' : '#ccc' }}
            disabled={!canSubmitFeedback}
            title={!canSubmitFeedback ? "Sending permission disabled" : ""}
          >
            ✔️ Approve Pending
          </button>
          <button
            type="button"
            className={styles.exportButton}
            onClick={logClick('FEEDBACK_REVIEW_EXPORT_EXCEL', handleExportExcel)}
          >
            📥 Export Excel Report
          </button>
        </div>
      </header>

      <main className={styles.main}>
        <ReviewFilters
          selectedCourse={selectedCourse}
          setSelectedCourse={setSelectedCourse}
          selectedAssignment={selectedAssignment}
          setSelectedAssignment={setSelectedAssignment}
          coursesList={coursesList}
          assignmentsList={assignmentsList}
          onClear={handleClearFilters}
        />

        {loading ? (
          <div className={styles.state}>Loading feedbacks...</div>
        ) : (
          <FeedbackTable
            feedbacks={filteredFeedbacks}
            onReview={handleReview}
            onEdit={handleEdit}
            selectedIds={selectedIds}
            onToggleSelection={toggleSelection}
            onToggleAllSelection={toggleAllSelection}
          />
        )}
      </main>

      <ApprovalModal
        isOpen={showApprovalModal}
        onClose={handleCloseModal}
        onApprove={handleApprove}
        onReject={handleReject}
        feedback={activeFeedback}
        isSubmitting={isApprovalSubmitting}
      />

      <EditFeedbackModal
        isOpen={showEditModal}
        onClose={handleCloseModal}
        onSave={handleEditSave}
        feedback={activeFeedback}
      />

      {pendingBulkApproval && (
        <ConfirmDialog
          isOpen={!!pendingBulkApproval}
          title="Bulk Approval"
          message={`Are you sure you want to approve and send ${pendingBulkApproval.length} pending feedbacks to Canvas?`}
          onConfirm={confirmBulkApprove}
          onClose={cancelBulkApprove}
        />
      )}

      {toastMessage && (
        <Toast
          message={toastMessage.message}
          type={toastMessage.type}
          onClose={() => setToastMessage(null)}
        />
      )}
    </div>
    </RequirePermission>
  );
}
