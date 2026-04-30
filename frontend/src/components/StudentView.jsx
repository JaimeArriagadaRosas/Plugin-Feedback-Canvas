// frontend/src/components/StudentView.jsx - Student feedback view (RF31-RF33)
import React, { useState, useEffect } from 'react';
import { useLTI } from './LTIContext';
import apiClient from '../services/api';

const StudentView = () => {
  const { user, token } = useLTI();
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFeedbacks();
  }, [user]);

  const loadFeedbacks = async () => {
    try {
      const response = await apiClient.get(
        `/feedback/student/${user.id}/history`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setFeedbacks(response.data.history || []);
    } catch (err) {
      console.error('Failed to load feedbacks:', err);
    } finally {
      setLoading(false);
    }
  };

  const rateFeedback = async (feedbackId, rating, comment) => {
    try {
      await apiClient.post(
        `/feedback/${feedbackId}/rate`,
        { rating, feedbackText: comment },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      loadFeedbacks(); // Refresh
    } catch (err) {
      console.error('Rating failed:', err);
    }
  };

  return (
    <div className="student-view">
      <h2>📬 Mi Retroalimentación</h2>
      
      {loading ? (
        <div className="spinner"></div>
      ) : feedbacks.length === 0 ? (
        <div className="empty-state">
          <p>No has recibido retroalimentación aún.</p>
        </div>
      ) : (
        <div className="feedbacks-list">
          {feedbacks.map((fb) => (
            <div key={fb.id} className="feedback-item">
              <div className="feedback-header">
                <div>
                  <h4>{fb.assignmentName}</h4>
                  <span className="course-name">{fb.courseName}</span>
                </div>
                <div className="feedback-meta">
                  <span className="grade">Calificación: {fb.grade}</span>
                  <span className="date">{new Date(fb.sentAt).toLocaleDateString()}</span>
                </div>
              </div>
              
              <div className="feedback-content">
                <p>{fb.content}</p>
              </div>

              {/* Utility rating */}
              {!fb.utilityRating && (
                <div className="utility-rating">
                  <p>¿Te fue útil este feedback?</p>
                  <div className="rating-buttons">
                    {[1, 2, 3, 4, 5].map(r => (
                      <button 
                        key={r}
                        className="rating-btn"
                        onClick={() => rateFeedback(fb.id, r, '')}
                      >
                        {r} ★
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {fb.utilityRating && (
                <div className="rated-badge">
                  ✅ Calificaste este feedback: {fb.utilityRating}/5
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudentView;
