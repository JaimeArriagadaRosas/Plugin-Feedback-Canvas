import React from 'react';
import { usePermissions } from '../../../hooks/usePermissions';
import styles from '../FeedbackDetailView.module.css';

export default function ActionControls({ onApprove, onSave, onBack }) {
  const { canEditFeedback, canSubmitFeedback } = usePermissions();
  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>ACTION CONTROLS</div>
      <div className={styles.cardBody}>
        <div style={{ fontSize: 12, color: "#666", marginBottom: "15px" }}>
          <strong>Status:</strong> Feedback displayed for review.<br />
          Customization Applied.<br />
          <strong>Last Local Sync:</strong> 11:30:05
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <button className={styles.btnPrimary} onClick={onApprove} disabled={!canSubmitFeedback} title={!canSubmitFeedback ? "Sending permission disabled" : ""}>APPROVE AND PUBLISH TO SPEEDGRADER</button>
          <button className={styles.btnSecondary} onClick={onSave} disabled={!canEditFeedback} title={!canEditFeedback ? "Editing permission disabled" : ""}>SAVE EDIT (WITHOUT SENDING)</button>
          <button className={styles.btnTertiary} onClick={onBack}>BACK TO LIST</button>
        </div>
      </div>
    </div>
  );
}
