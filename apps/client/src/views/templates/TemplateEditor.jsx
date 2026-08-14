import { useState, useCallback } from 'react';
import Card from '../../components/atoms/Card';
import Button from '../../components/atoms/Button';
import { useButtonLogger } from '../../hooks/useButtonLogger';
import { useTemplateEditor } from './hooks/useTemplateEditor';
import TemplateForm from './editor/TemplateForm';
import TextToolbar from '../../components/molecules/TextToolbar';
import VariableInserter from './editor/VariableInserter';
import LivePreview from './editor/LivePreview';
import AuditInfo from './editor/AuditInfo';
import TemplateEditorActions from './editor/TemplateEditorActions';
import Toast from '../../components/atoms/Toast';
import styles from './TemplateEditor.module.css';

export default function TemplateEditor({ template, onSave, onClose }) {
  const editor = useTemplateEditor(template);
  const logSave = useButtonLogger();
  const logClose = useButtonLogger();
  const logDelete = useButtonLogger();
  const [toast, setToast] = useState(null);

  const handleSave = useCallback(
    async (e) => {
      if (!editor.name?.trim()) {
        setToast({ message: "The template must have a name.", type: "error" });
        return;
      }
      
      const { alto, medio, bajo } = editor.content;
      if (!alto?.trim() || !medio?.trim() || !bajo?.trim()) {
        setToast({ message: "You cannot save a template with a blank range. Complete the High, Medium, and Low ranges.", type: "error" });
        return;
      }

      const payload = {
        ...template,
        name: editor.name,
        contenido: JSON.stringify(editor.content),
        ranges: 3
      };
      await logSave('TEMPLATE_EDITOR_SAVE', () => onSave?.(payload))(e);
    },
    [editor.name, editor.content, template, onSave, logSave]
  );

  const handleClose = useCallback(
    async (e) => {
      await logClose('TEMPLATE_EDITOR_CLOSE', () => onClose?.())(e);
    },
    [onClose, logClose]
  );

  const handleDelete = useCallback(
    async (e) => {
      await logDelete('TEMPLATE_EDITOR_DELETE', () => setToast({ message: "Delete function is protected", type: "info" }))(e);
    },
    [logDelete]
  );

  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <h1 className={styles.title}>
          {template ? "EDIT FEEDBACK TEMPLATE" : "CREATE NEW FEEDBACK TEMPLATE"}
        </h1>
        <div className={styles.breadcrumb}>
          <span>TEMPLATE MANAGEMENT</span>
          <span>/</span>
          <span className={styles.breadcrumbActive}>{template ? "EDIT" : "NEW"}</span>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.leftCol}>
          <Card title="⚙️ BASIC SETTINGS">
            <TemplateForm
              name={editor.name}
              setName={editor.setName}
            />
          </Card>

          <Card title="👁️ LIVE PREVIEW (LOCAL)">
            <LivePreview text={editor.preview} />
          </Card>
        </section>

        <section className={styles.rightCol}>
          <Card
            title={
              <>
                <span>✍️ INTEGRATED TEXT EDITOR</span>
                <span style={{ fontSize: 11, fontWeight: 'normal', color: '#718096' }}>Supports Basic Markdown</span>
              </>
            }
          >
            <TextToolbar
              onFormat={editor.applyFormat}
              onClear={() => editor.setContent('')}
            />
            <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: '8px' }}>
              <button 
                onClick={() => editor.setCurrentTab('alto')}
                style={{ padding: '8px 16px', border: 'none', background: editor.currentTab === 'alto' ? '#e2e8f0' : 'transparent', cursor: 'pointer', fontWeight: editor.currentTab === 'alto' ? 'bold' : 'normal' }}
              >High Range</button>
              <button 
                onClick={() => editor.setCurrentTab('medio')}
                style={{ padding: '8px 16px', border: 'none', background: editor.currentTab === 'medio' ? '#e2e8f0' : 'transparent', cursor: 'pointer', fontWeight: editor.currentTab === 'medio' ? 'bold' : 'normal' }}
              >Medium Range</button>
              <button 
                onClick={() => editor.setCurrentTab('bajo')}
                style={{ padding: '8px 16px', border: 'none', background: editor.currentTab === 'bajo' ? '#e2e8f0' : 'transparent', cursor: 'pointer', fontWeight: editor.currentTab === 'bajo' ? 'bold' : 'normal' }}
              >Low Range</button>
            </div>
            <textarea
              ref={editor.editorRef}
              className={styles.editor}
              value={editor.content[editor.currentTab] || ""}
              onChange={(e) => editor.setContent(e.target.value)}
              placeholder="Write your template here..."
            />
          </Card>

          <Card title="🧩 DYNAMIC VARIABLES">
            <p className={styles.variableHint}>
              Insert these tags so the AI replaces them with real course data:
            </p>
            <VariableInserter onInsert={editor.insertVariable} />
          </Card>

          {template && <AuditInfo />}
        </section>
      </main>

      <TemplateEditorActions 
        template={template} 
        handleDelete={handleDelete} 
        handleClose={handleClose} 
        handleSave={handleSave} 
      />

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
