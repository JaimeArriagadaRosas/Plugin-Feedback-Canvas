import React from 'react';
import { usePermissions } from '../../../hooks/usePermissions';
import styles from '../FeedbackDetailView.module.css';

export default function ActionControls({ onApprove, onSave, onBack }) {
  const { canEditFeedback, canSubmitFeedback } = usePermissions();
  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>CONTROLES DE ACCIÓN</div>
      <div className={styles.cardBody}>
        <div style={{ fontSize: 12, color: "#666", marginBottom: "15px" }}>
          <strong>Estado:</strong> Feedback visualizado para revisión.<br />
          Personalización Aplicada.<br />
          <strong>Última Sinc. Local:</strong> 11:30:05
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <button className={styles.btnPrimary} onClick={onApprove} disabled={!canSubmitFeedback} title={!canSubmitFeedback ? "Permiso de envío deshabilitado" : ""}>APROBAR Y PUBLICAR EN SPEEDGRADER</button>
          <button className={styles.btnSecondary} onClick={onSave} disabled={!canEditFeedback} title={!canEditFeedback ? "Permiso de edición deshabilitado" : ""}>GUARDAR EDICIÓN (SIN ENVIAR)</button>
          <button className={styles.btnTertiary} onClick={onBack}>VOLVER A LISTA</button>
        </div>
      </div>
    </div>
  );
}
