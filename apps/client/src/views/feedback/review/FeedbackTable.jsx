import { useMemo } from 'react';
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

const STATUS_COLORS = {
  'PENDIENTE': { bg: '#fef9e7', text: '#b58900' },
  'EDITADO': { bg: '#eef2f7', text: '#475569' },
  'APROBADO': { bg: '#e9f7ef', text: '#1d8348' },
  'RECHAZADO': { bg: '#fdedec', text: '#922b21' }
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

  // Obtenemos los IDs de los feedbacks pendientes para la casilla "Seleccionar Todos"
  const pendingFeedbacks = feedbacks.filter(fb => fb.status === 'PENDIENTE' || fb.status === 'EDITADO');
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
          title="Seleccionar todos los pendientes o editados"
        />
      ), 
      width: '5%',
      render: (_, row) => (
        <input 
          type="checkbox" 
          checked={selectedIds.has(row.id)}
          onChange={() => onToggleSelection(row.id)}
          disabled={row.status !== 'PENDIENTE' && row.status !== 'EDITADO'}
        />
      )
    },
    { key: 'student', label: 'Estudiante', width: '20%' },
    { key: 'grade', label: 'Calificación', width: '10%' },
    { key: 'profile', label: 'Perfil Académico (IA)', width: '15%', render: (value) => {
      const colors = PROFILE_COLORS[value] || { bg: '#eee', text: '#333' };
      return <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', backgroundColor: colors.bg, color: colors.text }}>{value}</span>;
    }},
    { key: 'trend', label: 'Tendencia', width: '10%', render: (value) => `${value === 'Mejorando' ? '📈' : value === 'Bajando' ? '📉' : '➖'} ${value}` },
    { key: 'status', label: 'Estado', width: '10%', render: (value) => {
      const colors = STATUS_COLORS[value] || { bg: '#eee', text: '#333' };
      return <span style={{ padding: '4px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px', minWidth: '80px', justifyContent: 'center', backgroundColor: colors.bg, color: colors.text, border: `1px solid ${colors.text}33` }}>{value}</span>;
    }},
    { key: 'actions', label: 'Acciones', width: '15%', render: (_, row) => {
      const isApproved = row.status === 'APROBADO' || row.status === 'ENVIADO';
      return (
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="secondary" size="sm" onClick={() => logReview('FEEDBACK_REVIEW_OPEN', () => onReview?.(row))()}>
            {isApproved ? 'Valorar' : 'Revisar'}
          </Button>
          {!isApproved && (
            <Button variant="primary" size="sm" onClick={() => logEdit('FEEDBACK_REVIEW_EDIT', () => onEdit?.(row))()}>
              Editar
            </Button>
          )}
        </div>
      );
    }},
  ], [onReview, onEdit, logReview, logEdit, selectedIds, onToggleSelection, onToggleAllSelection, allPendingSelected, pendingFeedbacks]);

  return (
    <div className={styles.wrapper}>
      {feedbacks.length === 0 ? (
        <div className={styles.empty}>No se han encontrado feedbacks generados aún. Ve a SpeedGrader para generar uno.</div>
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
