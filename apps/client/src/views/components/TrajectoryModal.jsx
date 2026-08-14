import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '../../api/apiClient';

export default function TrajectoryModal({ onClose, courseId, studentId }) {
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
        setError(err.message || 'Error analyzing trajectory');
      } finally {
        setLoading(false);
      }
    }
    if (courseId && studentId) {
      fetchHistory();
    }
  }, [courseId, studentId]);

  const analysis = useMemo(() => {
    if (!data || !data.history || data.history.length < 2) {
      return {
        canAnalyze: false,
        message: 'Not enough previous graded submissions to perform a comparative analysis.',
        suggestion: 'Continue grading the student to generate trend data.'
      };
    }

    const history = data.history;
    const last = history[history.length - 1];
    const prev = history[history.length - 2];

    const lastPct = (last.grade / (last.pointsPossible || 100)) * 100;
    const prevPct = (prev.grade / (prev.pointsPossible || 100)) * 100;
    const diff = lastPct - prevPct;
    
    let trendLabel = 'Maintains';
    let trendColor = '#383d41';
    let trendBg = '#e2e3e5';
    let suggestion = "The student's performance remains stable. It's a good time to challenge them a bit more.";

    if (diff >= 5) {
      trendLabel = 'Improvement';
      trendColor = '#155724';
      trendBg = '#d4edda';
      suggestion = 'Good progress detected. It is recommended to acknowledge their effort in the feedback to positively reinforce this attitude.';
    } else if (diff <= -5) {
      trendLabel = 'Decline';
      trendColor = '#721c24';
      trendBg = '#f8d7da';
      suggestion = 'Performance alert. It is advisable to inquire if the student is facing difficulties with recent material.';
    }

    return {
      canAnalyze: true,
      trendLabel,
      trendColor,
      trendBg,
      suggestion,
      lastAssignment: last.assignmentName,
      prevAssignment: prev.assignmentName,
      lastPct: lastPct.toFixed(1),
      prevPct: prevPct.toFixed(1),
      diff: Math.abs(diff).toFixed(1)
    };
  }, [data]);

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
        maxWidth: '550px',
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
            📈 Academic Trajectory Analysis
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
          padding: '24px',
          backgroundColor: '#fff'
        }}>
          {loading ? (
            <div style={{ animation: 'pulse 1.5s infinite', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ height: '60px', background: '#e0e0e0', borderRadius: '8px', width: '100%' }}></div>
              <div style={{ height: '40px', background: '#e0e0e0', borderRadius: '4px', width: '80%' }}></div>
              <div style={{ height: '20px', background: '#e0e0e0', borderRadius: '4px', width: '100%' }}></div>
            </div>
          ) : (error && !data) ? (
            <div style={{ color: 'red', textAlign: 'center', padding: '20px' }}>
              <p>An error occurred: {error}</p>
            </div>
          ) : (
            <div>
              {analysis.canAnalyze ? (
                <>
                  <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <span style={{ fontSize: '14px', color: '#666', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      Overall Status
                    </span>
                    <span style={{ 
                      background: analysis.trendBg,
                      color: analysis.trendColor,
                      padding: '8px 24px', 
                      borderRadius: '20px', 
                      fontSize: '18px', 
                      fontWeight: '800',
                      display: 'inline-block'
                    }}>
                      {analysis.trendLabel}
                    </span>
                  </div>

                  <div style={{ background: '#f8f9fa', border: '1px solid #e9ecef', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
                    <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#333' }}>Performance Detail</h3>
                    <p style={{ margin: '0 0 8px 0', fontSize: '14px', lineHeight: '1.5', color: '#555' }}>
                      The student went from getting <strong>{analysis.prevPct}%</strong> on <em>"{analysis.prevAssignment}"</em> to <strong>{analysis.lastPct}%</strong> on <em>"{analysis.lastAssignment}"</em>.
                    </p>
                    <p style={{ margin: 0, fontSize: '14px', color: '#555' }}>
                      This represents a <strong>{analysis.diff}%</strong> {analysis.trendLabel === 'Decline' ? 'drop' : (analysis.trendLabel === 'Improvement' ? 'improvement' : 'variation')} in their performance.
                    </p>
                  </div>

                  <div style={{ background: '#fff3cd', borderLeft: '4px solid #ffecb5', padding: '12px 16px', borderRadius: '0 4px 4px 0' }}>
                    <strong style={{ display: 'block', fontSize: '13px', color: '#856404', marginBottom: '4px' }}>💡 Recommendation:</strong>
                    <span style={{ fontSize: '13px', color: '#856404', lineHeight: '1.4' }}>
                      {analysis.suggestion}
                    </span>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <div style={{ fontSize: '40px', marginBottom: '16px' }}>🤷🏽‍♂️</div>
                  <h3 style={{ margin: '0 0 8px 0', color: '#333' }}>Insufficient Data</h3>
                  <p style={{ color: '#666', fontSize: '14px', lineHeight: '1.5', marginBottom: '16px' }}>{analysis.message}</p>
                  <p style={{ color: '#0770a3', fontSize: '13px', fontWeight: 'bold' }}>{analysis.suggestion}</p>
                </div>
              )}
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
            Accept
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
