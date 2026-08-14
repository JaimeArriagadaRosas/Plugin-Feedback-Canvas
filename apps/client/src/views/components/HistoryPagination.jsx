import React from 'react';

export default function HistoryPagination({ page, setPage, totalPages }) {
  if (totalPages <= 1) return null;
  
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '10px',
      marginTop: '10px',
      marginBottom: '20px'
    }}>
      <button 
        disabled={page === 1}
        onClick={() => setPage(page - 1)}
        style={{
          padding: '4px 8px',
          cursor: page === 1 ? 'not-allowed' : 'pointer',
          background: '#fff',
          border: '1px solid var(--color-border)',
          borderRadius: '4px'
        }}
      >
        Prev
      </button>
      <span style={{ fontSize: '12px', color: 'var(--color-text)' }}>Page {page} of {totalPages}</span>
      <button 
        disabled={page === totalPages}
        onClick={() => setPage(page + 1)}
        style={{
          padding: '4px 8px',
          cursor: page === totalPages ? 'not-allowed' : 'pointer',
          background: '#fff',
          border: '1px solid var(--color-border)',
          borderRadius: '4px'
        }}
      >
        Next
      </button>
    </div>
  );
}
