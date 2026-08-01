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
import styles from './FeedbackReviewPanel.module.css';

export default function FeedbackReviewPanel() {
  const logClick = useButtonLogger();
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
    handleEditSave,
    handleBulkApprove,
    confirmBulkApprove,
    cancelBulkApprove,
    pendingBulkApproval,
    handleExportExcel,
    toastMessage,
    setToastMessage,
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
    setSelectedCourse('Todos');
    setSelectedAssignment('Todas');
  }, [setSelectedCourse, setSelectedAssignment]);

  const handleCloseModal = useCallback(() => {
    setShowApprovalModal(false);
    setShowEditModal(false);
    setActiveFeedback(null);
  }, [setShowApprovalModal, setShowEditModal, setActiveFeedback]);

  return (
    <div className={styles.panel}>
      <header className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <PendingFeedbacksIndicator courseId={selectedCourse} />
          <h1 className={styles.title}>REVISIÓN DE FEEDBACKS</h1>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.exportButton}
            onClick={logClick('FEEDBACK_REVIEW_BULK_APPROVE', handleBulkApprove)}
            style={{ marginRight: '10px', backgroundColor: '#0374B5', color: '#fff', borderColor: '#0374B5' }}
          >
            ✔️ Aprobar Pendientes
          </button>
          <button
            type="button"
            className={styles.exportButton}
            onClick={logClick('FEEDBACK_REVIEW_EXPORT_EXCEL', handleExportExcel)}
          >
            📥 Exportar Reporte Excel
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
          <div className={styles.state}>Cargando feedbacks...</div>
        ) : (
          <FeedbackTable
            feedbacks={filteredFeedbacks}
            onReview={handleReview}
            onEdit={handleEdit}
          />
        )}
      </main>

      <ApprovalModal
        isOpen={showApprovalModal}
        onClose={handleCloseModal}
        onApprove={handleApprove}
        feedback={activeFeedback}
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
          title="Aprobación Masiva"
          message={`¿Seguro que deseas aprobar y enviar a Canvas ${pendingBulkApproval.length} feedbacks pendientes?`}
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
  );
}
