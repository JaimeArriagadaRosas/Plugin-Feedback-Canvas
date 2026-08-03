import React, { useState, useRef, useCallback } from 'react';
import Button from '../../components/atoms/Button';
import aiStyles from './SpeedGraderAIPanel.module.css';
import actionStyles from './FeedbackGenerator.module.css';
import TextToolbar from '../../components/molecules/TextToolbar';
import LivePreview from '../plantillas/editor/LivePreview';

export default function ManualFeedbackPanel({ 
  onSubmit, 
  loading 
}) {
  const [text, setText] = useState('');
  const editorRef = useRef(null);

  const applyFormat = useCallback((format) => {
    const editor = editorRef.current;
    if (!editor) return;

    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selection = editor.value.substring(start, end);
    let replacement = "";

    switch (format) {
      case "bold": replacement = `**${selection}**`; break;
      case "italic": replacement = `*${selection}*`; break;
      case "underline": replacement = `<u>${selection}</u>`; break;
      case "list": replacement = `\n- ${selection}`; break;
      case "numlist": replacement = `\n1. ${selection}`; break;
      default: replacement = selection;
    }

    const before = editor.value.substring(0, start);
    const after = editor.value.substring(end);
    setText(before + replacement + after);

    setTimeout(() => {
      editor.focus();
      editor.setSelectionRange(start + replacement.length, start + replacement.length);
    }, 0);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', flex: 1 }}>
      <section className={aiStyles.feedbackAdaptivePanel} style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '200px' }}>
        <div className={aiStyles.feedbackAdaptiveHeader}>
          FEEDBACK MANUAL
        </div>
        <div className={aiStyles.feedbackAdaptiveBody} style={{ padding: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
          <TextToolbar
            onFormat={applyFormat}
            onClear={() => setText('')}
          />
          <textarea
            ref={editorRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escribe el feedback para el estudiante aquí..."
            disabled={loading}
            style={{
              flex: 1,
              width: '100%',
              minHeight: '150px',
              border: 'none',
              borderTop: '1px solid var(--color-border)',
              padding: '12px',
              resize: 'vertical',
              fontSize: '14px',
              lineHeight: '1.5',
              fontFamily: 'var(--font-family)',
              color: 'var(--color-text)',
              outline: 'none',
              backgroundColor: 'transparent'
            }}
          />
        </div>
      </section>

      {text.trim() && (
        <section className={aiStyles.feedbackAdaptivePanel}>
          <div className={aiStyles.feedbackAdaptiveHeader}>
            VISTA PREVIA
          </div>
          <div className={aiStyles.feedbackAdaptiveBody} style={{ padding: '12px' }}>
            <LivePreview text={text} />
          </div>
        </section>
      )}

      <Button
        variant="primary"
        onClick={() => {
            if (text.trim()) {
                onSubmit(text);
                setText('');
            }
        }}
        disabled={loading || !text.trim()}
        className={actionStyles.action}
      >
        {loading ? "GUARDANDO..." : "GUARDAR Y ENVIAR"}
      </Button>
    </div>
  );
}
