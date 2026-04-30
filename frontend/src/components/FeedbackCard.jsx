// frontend/src/components/FeedbackCard.jsx - Individual feedback review card (RF25-30)
import React, { useState } from 'react';

const FeedbackCard = ({ 
  feedback, 
  onApprove, 
  onReject, 
  studentName, 
  loading,
  isReadOnly = false 
}) => {
  const [editedContent, setEditedContent] = useState(feedback.content);
  const [isEditing, setIsEditing] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showQualityRating, setShowQualityRating] = useState(feedback.status === 'sent');

  const handleQuickEdit = (action) => {
    if (action === 'more_formal') {
      setEditedContent(editedContent.replace(/¡/g, '').replace(/!/g, '.'));
    } else if (action === 'more_empathetic') {
      setEditedContent('Comprendo tu situación. ' + editedContent);
    }
  };

  const handleRateQuality = async (rating) => {
    try {
      await fetch(`/api/feedback/${feedback.id}/rate-quality`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating })
      });
      setShowQualityRating(false);
    } catch (err) {
      console.error('Rating failed:', err);
    }
  };

  const statusClass = feedback.status === 'pending' ? 'status-pending' : 
                     feedback.status === 'sent' ? 'status-sent' : 'status-edited';

  return (
    <div className={`feedback-card ${statusClass}`}>
      <div className="feedback-header">
        <div className="student-name">
          <h3>{studentName}</h3>
          <span className="grade-badge">Nota: {feedback.grade}</span>
          <span className="range-badge">{feedback.gradeRange}</span>
        </div>
        <div className="feedback-actions">
          {feedback.status === 'pending' && (
            <>
              <button 
                className="btn btn-success"
                onClick={() => onApprove(feedback.id)}
                disabled={loading}
              >
                Aprobar y Enviar
              </button>
              <button 
                className="btn btn-outline"
                onClick={() => setIsEditing(true)}
              >
                Editar
              </button>
              <button 
                className="btn btn-danger"
                onClick={() => onReject(feedback.id, rejectReason || 'Requiere cambios')}
              >
                Rechazar
              </button>
            </>
          )}
          {feedback.status === 'edited' && (
            <button 
              className="btn btn-success"
              onClick={() => onApprove(feedback.id)}
            >
              Aprobar Envío
            </button>
          )}
        </div>
      </div>

      {feedback.aiModelUsed && (
        <div className="ai-meta">
          <small>
            🤖 Generado por {feedback.aiModelUsed} • {feedback.tokensUsed} tokens • 
            {feedback.generationTimeMs}ms
            {feedback.isFallback && ' ⚠️ (Modo fallback)'}
          </small>
        </div>
      )}

      <div className="feedback-content">
        {isEditing ? (
          <div className="editor">
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              rows="8"
              className="feedback-textarea"
            />
            <div className="quick-actions">
              <span>Acciones rápidas:</span>
              <button onClick={() => handleQuickEdit('more_formal')} className="btn btn-sm">Más formal</button>
              <button onClick={() => handleQuickEdit('more_empathetic')} className="btn btn-sm">Más empático</button>
            </div>
            <div className="editor-actions">
              <button 
                className="btn btn-primary"
                onClick={() => { onApprove(feedback.id, editedContent); setIsEditing(false); }}
              >
                Guardar y Aprobar
              </button>
              <button className="btn btn-secondary" onClick={() => setIsEditing(false)}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="feedback-text">
            <p>{editedContent}</p>
          </div>
        )}

      {/* Student context for teacher reference */}
      {feedback.studentContext && (
        <details className="context-details">
          <summary>📊 Contexto del estudiante</summary>
          <div className="context-info">
            <p><strong>Historial:</strong> {feedback.studentContext.history?.join(', ') || 'Sin historial'}</p>
            <p><strong>Promedio del curso:</strong> {feedback.studentContext.courseAverage?.toFixed(1) || 'N/A'}</p>
            <p><strong>Tendencia:</strong> {feedback.studentContext.variables?.trend || 'N/A'}</p>
          </div>
        </details>
      )}
    </div>

    {/* Private notes (RF29) */}
    {feedback.status === 'pending' && (
      <div className="private-notes">
        <label>Notas privadas (solo para ti):</label>
        <textarea
          placeholder="Agrega notas internas sobre este feedback..."
          rows="2"
        />
      </div>
    )}

    {/* Quality rating (RF08) */}
    {showQualityRating && feedback.status === 'sent' && (
      <div className="quality-rating">
        <label>¿Fue útil este feedback?</label>
        <div className="star-rating">
          {[1, 2, 3, 4, 5].map(star => (
            <span 
              key={star} 
              className={`star ${feedback.qualityRating >= star ? 'filled' : ''}`}
              onClick={() => handleRateQuality(star)}
            >
              ★
            </span>
          ))}
        </div>
      </div>
    )}

    {/* Canvas integration note */}
    <div className="canvas-note">
      <small>
        📌 Este feedback se insertará como comentario en la rúbrica de Canvas.
      </small>
    </div>
  </div>
);

export default FeedbackCard;
