// frontend/src/components/SpeedGraderPanel.jsx - Main grading panel (RF16, RF23-30)
import React, { useState, useEffect } from 'react';
import { useLTI } from './LTIContext';
import FeedbackCard from './FeedbackCard';
import apiClient from '../services/api';

const SpeedGraderPanel = () => {
  const { context, token } = useLTI();
  const [submissions, setSubmissions] = useState([]);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (context.assignmentId && context.courseId) {
      loadSubmissions();
      loadStats();
    }
  }, [context.assignmentId, context.courseId]);

  const loadSubmissions = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get(
        `/courses/${context.courseId}/assignments/${context.assignmentId}/submissions`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSubmissions(response.data.submissions || []);
    } catch (err) {
      setError('Error cargando envíos');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await apiClient.get(
        `/reports/dashboard/${context.courseId}/${context.assignmentId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStats(response.data);
    } catch (err) {
      console.error('Stats error:', err);
    }
  };

  const generateFeedback = async (submission) => {
    setLoading(true);
    try {
      const response = await apiClient.post(
        '/feedback/generate',
        {
          studentId: submission.userId,
          assignmentId: context.assignmentId,
          courseId: context.courseId,
          grade: submission.grade
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setFeedback({
        ...response.data.feedback,
        studentId: submission.userId,
        studentName: submission.userName
      });
      setSelectedSubmission(submission);
      
      // Refresh stats
      loadStats();
    } catch (err) {
      setError(err.response?.data?.error || 'Error generando feedback');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (feedbackId, editedContent = null) => {
    try {
      await apiClient.post(
        `/feedback/${feedbackId}/approve`,
        editedContent ? { editedContent } : {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setFeedback(null);
      loadSubmissions();
    } catch (err) {
      setError('Error aprobando feedback');
    }
  };

  const handleReject = async (feedbackId, reason) => {
    try {
      await apiClient.post(
        `/feedback/${feedbackId}/reject`,
        { reason },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setFeedback(null);
      loadSubmissions();
    } catch (err) {
      setError('Error rechazando feedback');
    }
  };

  // RF30: Status badges
  const getStatusBadge = (status) => {
    const badges = {
      pending: { label: 'Pendiente', class: 'badge-yellow' },
      approved: { label: 'Aprobado', class: 'badge-green' },
      edited: { label: 'Editado', class: 'badge-blue' },
      rejected: { label: 'Rechazado', class: 'badge-red' },
      sent: { label: 'Enviado', class: 'badge-gray' }
    };
    return badges[status] || { label: status, class: 'badge-gray' };
  };

  return (
    <div className="speedgrader-panel">
      <div className="panel-header">
        <h2>📝 Revisión de Feedback</h2>
        <div className="stats-summary">
          {stats && (
            <>
              <span className="stat-item">
                Total: <strong>{stats.summary.total}</strong>
              </span>
              <span className="stat-item pending">
                Pendientes: <strong>{stats.summary.byStatus?.pending || 0}</strong>
              </span>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      <div className="panel-content">
        <div className="submissions-list">
          <h3>Estudiantes ({submissions.length})</h3>
          {loading ? (
            <div className="spinner-small"></div>
          ) : submissions.length === 0 ? (
            <p className="empty-state">No hay envíos calificados aún.</p>
          ) : (
            <div className="list">
              {submissions.map((sub) => (
                <div 
                  key={sub.submissionId}
                  className={`submission-item ${selectedSubmission?.submissionId === sub.submissionId ? 'selected' : ''}`}
                  onClick={() => setSelectedSubmission(sub)}
                >
                  <div className="student-info">
                    <span className="name">{sub.userName}</span>
                    <span className="grade">Calificación: {sub.grade}</span>
                  </div>
                  <div className="feedback-status">
                    {sub.feedbackExists && (
                      <span className={`badge ${getStatusBadge(sub.feedbackStatus).class}`}>
                        {getStatusBadge(sub.feedbackStatus).label}
                      </span>
                    )}
                    {!sub.feedbackExists && (
                      <button 
                        className="btn btn-primary btn-sm"
                        onClick={(e) => { e.stopPropagation(); generateFeedback(sub); }}
                        disabled={loading}
                      >
                        Generar Feedback
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="feedback-editor">
          {feedback ? (
            <FeedbackCard
              feedback={feedback}
              onApprove={handleApprove}
              onReject={handleReject}
              studentName={selectedSubmission?.userName}
              loading={loading}
            />
          ) : selectedSubmission ? (
            <div className="placeholder">
              <p>Selecciona "Generar Feedback" para crear retroalimentación para este estudiante.</p>
            </div>
          ) : (
            <div className="placeholder">
              <p>Selecciona un estudiante de la lista para ver o generar feedback.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SpeedGraderPanel;
