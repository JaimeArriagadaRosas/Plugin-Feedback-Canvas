import React from 'react';

export default function TutorialModal({ onClose }) {
  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      fontFamily: "'Lato', sans-serif"
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '8px',
        width: '90%',
        maxWidth: '800px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '15px 20px',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#f5f5f5'
        }}>
          <h2 style={{ margin: 0, fontSize: '18px', color: '#2d3b45', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🎥</span> Plugin Tutorial
          </h2>
          <button 
            onClick={onClose}
            title="Close Tutorial"
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#666',
              lineHeight: 1,
              padding: '0 4px'
            }}
          >
            &times;
          </button>
        </div>
        <div style={{ padding: '20px', backgroundColor: '#fff' }}>
          <p style={{ margin: '0 0 15px 0', color: '#555', fontSize: '14px' }}>
            Welcome to the Feedback Plugin tutorial. Below is an introductory institutional video from Andrés Bello University.
          </p>
          <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: '4px' }}>
            {/* Suggested YouTube Placeholder (UNAB) */}
            <iframe 
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
              src="https://www.youtube.com/embed/a0rdnqX3rGc" 
              title="Tutorial Plugin Feedback - UNAB" 
              frameBorder="0" 
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
              referrerPolicy="strict-origin-when-cross-origin" 
              allowFullScreen>
            </iframe>
          </div>
        </div>
        <div style={{
          padding: '15px 20px',
          borderTop: '1px solid #e0e0e0',
          display: 'flex',
          justifyContent: 'flex-end',
          backgroundColor: '#f9f9f9'
        }}>
          <button 
            onClick={onClose}
            style={{
              padding: '8px 16px',
              backgroundColor: '#0770a3',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '14px'
            }}
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
}
