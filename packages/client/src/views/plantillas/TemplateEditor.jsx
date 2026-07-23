import { useState, useCallback } from 'react';
import Card from '../../components/atoms/Card';
import Button from '../../components/atoms/Button';
import { useButtonLogger } from '../../hooks/useButtonLogger';
import { useTemplateEditor } from './hooks/useTemplateEditor';
import TemplateForm from './editor/TemplateForm';
import TextToolbar from './editor/TextToolbar';
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
      await logDelete('TEMPLATE_EDITOR_DELETE', () => setToast({ message: "Función de borrado protegida", type: "info" }))(e);
    },
    [logDelete]
  );

  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <h1 className={styles.title}>
          {template ? "MODIFICAR PLANTILLA DE FEEDBACK" : "CREAR NUEVA PLANTILLA DE FEEDBACK"}
        </h1>
        <div className={styles.breadcrumb}>
          <span>GESTIÓN PLANTILLAS</span>
          <span>/</span>
          <span className={styles.breadcrumbActive}>{template ? "EDITAR" : "NUEVA"}</span>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.leftCol}>
          <Card title="⚙️ CONFIGURACIÓN BÁSICA">
            <TemplateForm
              name={editor.name}
              setName={editor.setName}
            />
          </Card>

          <Card title="👁️ VISTA PREVIA (LOCAL)">
            <LivePreview text={editor.preview} />
          </Card>
        </section>

        <section className={styles.rightCol}>
          <Card
            title={
              <>
                <span>✍️ EDITOR DE TEXTO INTEGRADO</span>
                <span style={{ fontSize: 11, fontWeight: 'normal', color: '#718096' }}>Soporta Markdown Básico</span>
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
              >Rango Alto (6.0-7.0)</button>
              <button 
                onClick={() => editor.setCurrentTab('medio')}
                style={{ padding: '8px 16px', border: 'none', background: editor.currentTab === 'medio' ? '#e2e8f0' : 'transparent', cursor: 'pointer', fontWeight: editor.currentTab === 'medio' ? 'bold' : 'normal' }}
              >Rango Medio (4.0-5.9)</button>
              <button 
                onClick={() => editor.setCurrentTab('bajo')}
                style={{ padding: '8px 16px', border: 'none', background: editor.currentTab === 'bajo' ? '#e2e8f0' : 'transparent', cursor: 'pointer', fontWeight: editor.currentTab === 'bajo' ? 'bold' : 'normal' }}
              >Rango Bajo (1.0-3.9)</button>
            </div>
            <textarea
              ref={editor.editorRef}
              className={styles.editor}
              value={editor.content[editor.currentTab] || ""}
              onChange={(e) => editor.setContent(e.target.value)}
              placeholder="Escribe tu plantilla aquí..."
            />
          </Card>

          <Card title="🧩 VARIABLES DINÁMICAS">
            <p className={styles.variableHint}>
              Inserta estas etiquetas para que la IA las reemplace con datos reales del curso:
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
