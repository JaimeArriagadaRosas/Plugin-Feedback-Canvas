import { useMemo } from 'react';
import { isFinalFeedbackState, isReviewableFeedbackState } from '@plugin-feedback/contracts';
import { useButtonLogger } from '../../../hooks/useButtonLogger';
import Badge from '../../../components/atoms/Badge';
import Button from '../../../components/atoms/Button';
import styles from './FeedbackTable.module.css';

const PROFILE_COLORS = {
  'SOBRESALIENTE': { bg: '#e9f7ef', text: '#1d8348' },
  'PROMEDIO': { bg: '#ebf5fb', text: '#1a5276' },
  'EN RIESGO': { bg: '#fdedec', text: '#922b21' },
  'DESTACADO': { bg: '#efeaf9', text: '#673ab7' },
  'REQUIERE APOYO': { bg: '#fff5e6', text: '#e67e22' }
};

const PROFILE_TRANSLATIONS = {
  'SOBRESALIENTE': 'OUTSTANDING',
  'PROMEDIO': 'AVERAGE',
  'EN RIESGO': 'AT RISK',
  'DESTACADO': 'EXCELLENT',
  'REQUIERE APOYO': 'NEEDS SUPPORT'
};

const STATUS_COLORS = {
  'PENDIENTE': { bg: '#fef9e7', text: '#b58900' },
  'EDITADO': { bg: '#eef2f7', text: '#475569' },
  'APROBADO': { bg: '#e9f7ef', text: '#1d8348' },
  'ENVIADO': { bg: '#e9f7ef', text: '#1d8348' },
  'RECHAZADO': { bg: '#fdedec', text: '#922b21' }
};

const STATUS_TRANSLATIONS = {
  'PENDIENTE': 'PENDING',
  'EDITADO': 'EDITED',
  'APROBADO': 'APPROVED',
  'ENVIADO': 'SENT',
  'RECHAZADO': 'REJECTED'
};

export default function FeedbackTable({
  feedbacks,
  onReview,
  onEdit,
  selectedIds = new Set(),
  onToggleSelection,
  onToggleAllSelection,
}) {
  const logReview = useButtonLogger();
  const logEdit = useButtonLogger();

  // Get the pending feedback IDs for the "Select All" checkbox
  const pendingFeedbacks = feedbacks.filter((feedback) => isReviewableFeedbackState(feedback.status));
  const allPendingSelected = pendingFeedbacks.length > 0 && pendingFeedbacks.every(fb => selectedIds.has(fb.id));

  const columns = useMemo(() => [
    { 
      key: 'checkbox', 
      label: (
        <input 
          type="checkbox" 
          checked={allPendingSelected}
          onChange={() => onToggleAllSelection(pendingFeedbacks.map(fb => fb.id))}
          disabled={pendingFeedbacks.length === 0}
          title="Select all pending or edited"
        />
      ), 
      width: '5%',
      render: (_, row) => (
        <input 
          type="checkbox" 
          checked={selectedIds.has(row.id)}
          onChange={() => onToggleSelection(row.id)}
          disabled={!isReviewableFeedbackState(row.status)}
        />
      )
    },
    { key: 'student', label: 'Student', width: '20%' },
    { key: 'grade', label: 'Grade', width: '10%' },
    { key: 'profile', label: 'Academic Profile (AI)', width: '15%', render: (value) => {
      const colors = PROFILE_COLORS[value] || { bg: '#eee', text: '#333' };
      return <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', backgroundColor: colors.bg, color: colors.text }}>{PROFILE_TRANSLATIONS[value] || value}</span>;
    }},
    { key: 'trend', label: 'Trend', width: '10%', render: (value) => `${value === 'Mejora' ? '📈' : value === 'Retroceso' ? '📉' : '➖'} ${value === 'Mejora' ? 'Improving' : value === 'Retroceso' ? 'Declining' : 'Stable'}` },
    { key: 'status', label: 'Status', width: '10%', render: (value) => {
      const colors = STATUS_COLORS[value] || { bg: '#eee', text: '#333' };
      return <span style={{ padding: '4px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px', minWidth: '80px', justifyContent: 'center', backgroundColor: colors.bg, color: colors.text, border: `1px solid ${colors.text}33` }}>{STATUS_TRANSLATIONS[value] || value}</span>;
    }},
    { key: 'actions', label: 'Actions', width: '15%', render: (_, row) => {
      const isApproved = isFinalFeedbackState(row.status);
      return (
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="secondary" size="sm" onClick={() => logReview('FEEDBACK_REVIEW_OPEN', () => onReview?.(row))()}>
            {isApproved ? 'Rate' : 'Review'}
          </Button>
          {!isApproved && (
            <Button variant="primary" size="sm" onClick={() => logEdit('FEEDBACK_REVIEW_EDIT', () => onEdit?.(row))()}>
              Edit
            </Button>
          )}
        </div>
      );
    }},
  ], [onReview, onEdit, logReview, logEdit, selectedIds, onToggleSelection, onToggleAllSelection, allPendingSelected, pendingFeedbacks]);

  return (
    <div className={styles.wrapper}>
      {feedbacks.length === 0 ? (
        <div className={styles.empty}>No generated feedbacks found yet. Go to SpeedGrader to generate one.</div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} style={{ width: col.width, textAlign: col.key === 'checkbox' ? 'center' : 'left' }}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {feedbacks.map((fb) => (
              <tr key={fb.id} style={{ backgroundColor: selectedIds.has(fb.id) ? '#f0f8ff' : 'transparent' }}>
                {columns.map((col) => (
                  <td key={col.key} style={{ textAlign: col.key === 'checkbox' ? 'center' : 'left' }}>{col.render ? col.render(fb[col.key], fb) : fb[col.key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
