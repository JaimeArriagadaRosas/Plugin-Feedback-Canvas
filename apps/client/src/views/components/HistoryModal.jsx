import React, { useState, useEffect } from 'react';
import HistoryTable from './HistoryTable';
import HistoryPagination from './HistoryPagination';
import apiClient from '../../api/apiClient';

export default function HistoryModal({ onClose, courseId, studentId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchHistory() {
      try {
        setLoading(true);
        const res = await apiClient.get(`/feedback/history/${courseId}/${studentId}`);
        setData(res.data);
      } catch (err) {
        setError(err.message || 'Error loading history');
      } finally {
        setLoading(false);
      }
    }
    if (courseId && studentId) {
      fetchHistory();
    }
  }, [courseId, studentId]);

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      fontFamily: 'var(--font-family)',
      padding: '20px'
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '8px',
        width: '100%',
        maxWidth: '600px',
        maxHeight: '80vh',
        boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#f5f5f5'
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '16px',
            fontWeight: 700,
            color: 'var(--color-text)',
            textTransform: 'uppercase',
            letterSpacing: '0.3px'
          }}>
            📊 Grade History
          </h2>
          <button
            onClick={onClose}
            title="Close"
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '22px',
              cursor: 'pointer',
              color: '#666',
              lineHeight: 1,
              padding: '0 4px'
            }}
          >
            ×
          </button>
        </div>

        <div style={{
          padding: '20px',
          overflowY: 'auto',
          flex: 1,
          backgroundColor: '#fff'
        }}>
          {loading ? (
            <div style={{ animation: 'pulse 1.5s infinite', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ height: '30px', background: '#e0e0e0', borderRadius: '4px', width: '40%' }}></div>
              <div style={{ height: '20px', background: '#e0e0e0', borderRadius: '4px', width: '100%', marginTop: '15px' }}></div>
              <div style={{ height: '20px', background: '#e0e0e0', borderRadius: '4px', width: '100%' }}></div>
              <div style={{ height: '20px', background: '#e0e0e0', borderRadius: '4px', width: '100%' }}></div>
            </div>
          ) : (error && !data) ? (
            <div style={{ color: 'red', textAlign: 'center', padding: '20px' }}>
              <p>An error occurred: {error}</p>
            </div>
          ) : (
            <div>
              <div style={{ marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold' }}>Current Trend:</span>
                <span style={{ 
                  background: data?.trend === 'Mejora' ? '#d4edda' : data?.trend === 'Baja' ? '#f8d7da' : '#e2e3e5',
                  color: data?.trend === 'Mejora' ? '#155724' : data?.trend === 'Baja' ? '#721c24' : '#383d41',
                  padding: '4px 8px', borderRadius: '12px', fontSize: '14px', fontWeight: 'bold' 
                }}>
                  {data?.trend === 'Mejora' ? 'Improvement' : data?.trend === 'Baja' ? 'Decline' : data?.trend || 'No data'}
                </span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ccc' }}>
                    <th style={{ padding: '10px' }}>Assignment</th>
                    <th style={{ padding: '10px' }}>Score</th>
                    <th style={{ padding: '10px' }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.history?.length > 0 ? data.history.map((h, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '10px' }}>{h.assignmentName}</td>
                      <td style={{ padding: '10px' }}>{h.grade} / {h.pointsPossible}</td>
                      <td style={{ padding: '10px' }}>{new Date(h.date).toLocaleDateString()}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan="3" style={{ padding: '10px', textAlign: 'center' }}>No previous submissions.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          justifyContent: 'flex-end',
          backgroundColor: '#f9f9f9'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 18px',
              backgroundColor: '#0770a3',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '13px'
            }}
          >
            Close
          </button>
        </div>
      </div>
      <style>{`
        @keyframes pulse {
          0% { opacity: 0.6; }
          50% { opacity: 1; }
          100% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}
