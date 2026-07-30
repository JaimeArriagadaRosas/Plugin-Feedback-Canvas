import React from 'react';
import styles from '../FeedbackDetailView.module.css';

export default function FeedbackEditor({ text, setText }) {
  return (
    <div className={styles.card} style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <div className={styles.cardHeader}>TEXTO GENERADO PARA EDICIÓN</div>
      <div style={{ padding: "10px 15px", borderBottom: "1px solid #eee", fontSize: 13, background: "#f9f9f9" }}>
        Previsualización y Edición de Feedback
      </div>
      <div className={styles.toolbar}>
        <button className={styles.toolBtn}><b>B</b></button>
        <button className={styles.toolBtn}><i>I</i></button>
        <button className={styles.toolBtn}><u>U</u></button>
        <div style={{ width: "1px", background: "#ddd", margin: "0 5px" }} />
        <button className={styles.toolBtn}>•≡</button>
        <button className={styles.toolBtn}>1≡</button>
        <button className={styles.toolBtn}>≡</button>
        <div style={{ width: "1px", background: "#ddd", margin: "0 5px" }} />
        <button className={styles.toolBtn}>↩</button>
        <button className={styles.toolBtn}>↪</button>
      </div>
      <textarea
        className={styles.editor}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
    </div>
  );
}
