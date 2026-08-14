import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './SpeedGraderHeader.module.css';

export default function SpeedGraderHeader({ courseId, onBack, onShowTutorial }) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleOut(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', handleOut);
    return () => document.removeEventListener('mousedown', handleOut);
  }, [menuOpen]);

  return (
    <header className={styles.header}>
      <button className={styles.backButton} onClick={onBack}>
        ← Back
      </button>

      <div ref={menuRef} className={styles.headerMenu}>
        <button
          className={styles.backButton}
          onClick={() => setMenuOpen(o => !o)}
        >
          Options
        </button>
        {menuOpen && (
          <div className={styles.headerDropdown}>
            <button
              className={styles.headerDropdownItem}
              onClick={() => { setMenuOpen(false); navigate('/teacher/review'); }}
            >
              📋 Feedback Review
            </button>
            <button
              className={styles.headerDropdownItem}
              onClick={() => { setMenuOpen(false); navigate('/teacher/variables', { state: { course: { id: courseId } } }); }}
            >
              ⚙️ Customization Variables
            </button>
            <button
              className={styles.headerDropdownItem}
              onClick={() => { setMenuOpen(false); onShowTutorial(); }}
            >
              🎥 Tutorial
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
