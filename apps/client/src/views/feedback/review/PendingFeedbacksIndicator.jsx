import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from 'shared/api';
import styles from './PendingFeedbacksIndicator.module.css';

export default function PendingFeedbacksIndicator({ courseId }) {
  const [showPopover, setShowPopover] = useState(false);
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
    refetchInterval: 10000, // Polling cada 10s
  });

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

  return (
    <div className={styles.container} ref={popoverRef}>
      <button 
        className={styles.bellButton} 
        onClick={() => setShowPopover(!showPopover)}
        title="Feedbacks Pendientes"
      >
        🔔
        {hasPending && <span className={styles.badge}>{summary.count}</span>}
      </button>

      {showPopover && (
        <div className={styles.popover}>
          <div className={styles.popoverHeader}>
            <h4>Alumnos con Feedback Pendiente</h4>
          </div>
          <div className={styles.popoverBody}>
            {hasPending ? (
              <ul className={styles.studentList}>
                {groupedStudents.map((student, index) => (
                  <li key={index}>
                    {student.name} {student.count > 1 ? `(${student.count})` : ''}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.noPendingMsg}>No hay feedbacks pendientes.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
