import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api';
import styles from './PendingFeedbacksIndicator.module.css';

export default function PendingFeedbacksIndicator({ courseId }) {
  const [showPopover, setShowPopover] = useState(false);
  const [activeTab, setActiveTab] = useState('feedback'); // 'feedback' o 'errores'
  const popoverRef = useRef(null);

  const { data: summary = { count: 0, students: [] } } = useQuery({
    queryKey: ['pending-summary', courseId],
    queryFn: async () => {
      const qs = courseId && courseId !== 'Todos' ? `?courseId=${courseId}` : '';
      const response = await api.get(`/feedback/pending/summary${qs}`);
      if (response.exito) {
        return response.data;
      }
      return { count: 0, students: [] };
    },
    refetchInterval: 10000,
  });

  const { data: systemErrors = [], refetch: refetchSystemErrors } = useQuery({
    queryKey: ['system-notifications-pending'],
    queryFn: async () => {
      const response = await api.get(`/system-notifications/pending`);
      if (response.exito) {
        return response.data;
      }
      return [];
    },
    refetchInterval: 15000,
  });

  const handleClearError = async (tipo_error) => {
    try {
      await api.post('/system-notifications/clear', { tipo_error });
      refetchSystemErrors();
    } catch (e) {
      console.error('Error clearing notification:', e);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setShowPopover(false);
      }
    };
    if (showPopover) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPopover]);

  const hasPending = summary.count > 0;

  const groupedStudents = React.useMemo(() => {
    if (!summary || !summary.students) return [];
    
    const counts = {};
    summary.students.forEach(student => {
      counts[student] = (counts[student] || 0) + 1;
    });

    return Object.entries(counts).map(([name, count]) => ({
      name,
      count
    }));
  }, [summary.students]);

  const errorLabels = {
    'CANVAS_CONNECTION_FAILED': 'Canvas connection failed',
    'AI_GENERATION_FAILED': 'AI generation error',
    'INSUFFICIENT_DATA': 'Insufficient data',
    'NOTIFICATION_FAILED': 'Notification send failed'
  };

  const totalErrors = systemErrors.reduce((acc, curr) => acc + parseInt(curr.cantidad || 0, 10), 0);
  const totalNotifications = summary.count + totalErrors;
  const hasNotifications = totalNotifications > 0;

  return (
    <div className={styles.container} ref={popoverRef}>
      <button 
        className={styles.bellButton} 
        onClick={() => setShowPopover(!showPopover)}
        title="Notifications"
      >
        🔔
        {hasNotifications && <span className={styles.badge}>{totalNotifications}</span>}
      </button>

      {showPopover && (
        <div className={styles.popover}>
          <div className={styles.popoverHeader}>
            <h4>Notifications</h4>
            <button 
              className={styles.emojiToggleBtn}
              onClick={() => setActiveTab(activeTab === 'feedback' ? 'errores' : 'feedback')}
              title={activeTab === 'feedback' ? 'View Errors' : 'View Feedback'}
            >
              {activeTab === 'feedback' ? '⚠️' : '📝'}
            </button>
          </div>
          <div className={styles.popoverBody}>
            {activeTab === 'errores' && (
              <div className={styles.errorSection}>
                <div className={styles.sectionHeader}>
                  <h5 className={styles.sectionTitle}>System Errors</h5>
                </div>
                {systemErrors.length > 0 ? (
                  <ul className={styles.errorList}>
                    {systemErrors.map((err, index) => (
                      <li key={index} className={styles.errorItem}>
                        <span className={styles.errorLabel}>
                          {errorLabels[err.tipo_error] || err.tipo_error} ({err.cantidad})
                        </span>
                        <button 
                          className={styles.clearBtn} 
                          onClick={() => handleClearError(err.tipo_error)}
                          title="Clear error"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.noPendingMsg}>No error notifications.</p>
                )}
              </div>
            )}
            
            {activeTab === 'feedback' && (
              <div className={styles.feedbackSection}>
                <div className={styles.sectionHeader}>
                  <h5 className={styles.sectionTitle}>Pending Feedback</h5>
                </div>
                {hasPending ? (
                  <ul className={styles.studentList}>
                    {groupedStudents.map((student, index) => (
                      <li key={index}>
                        {student.name} {student.count > 1 ? `(${student.count})` : ''}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.noPendingMsg}>No pending feedbacks.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
