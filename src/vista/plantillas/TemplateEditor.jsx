import { useState, useEffect, useRef } from "react";
import StatusFooter from "../cursos/StatusFooter";

const styles = {
  wrapper: {
    fontFamily: "'Lato', 'Helvetica Neue', Arial, sans-serif",
    fontSize: 14,
    color: "#2d3b45",
    background: "#f5f5f5",
    minHeight: "100%",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    padding: "24px 30px",
    background: "#fff",
    borderBottom: "1px solid #c7cdd1",
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: "#2d3b45",
    textTransform: "uppercase",
    margin: 0,
    letterSpacing: "0.5px",
  },
  breadcrumb: {
    display: "flex",
    gap: "10px",
    marginTop: "8px",
    fontSize: 12,
    color: "#8899a6",
  },
  main: {
    flex: 1,
    padding: "24px 30px",
    display: "flex",
    gap: "24px",
    flexDirection: "row",
    flexWrap: "wrap",
  },
  leftCol: {
    flex: "1 1 350px",
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    minWidth: "350px",
  },
  rightCol: {
    flex: "2 1 600px",
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    minWidth: "400px",
  },
  card: {
    background: "#fff",
    border: "1px solid #c7cdd1",
    borderRadius: "8px",
    boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  cardHeader: {
    padding: "12px 20px",
    background: "#f8f9fa",
    borderBottom: "1px solid #e1e4e8",
    fontWeight: 700,
    fontSize: 13,
    color: "#2d3b45",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardBody: {
    padding: "20px",
    flex: 1,
  },
  label: {
    display: "block",
    fontWeight: 700,
    marginBottom: "8px",
    fontSize: 13,
    color: "#2d3b45",
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "6px",
    border: "1px solid #c7cdd1",
    fontSize: 14,
    boxSizing: "border-box",
    transition: "border-color 0.2s",
    outline: "none",
  },
  select: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "6px",
    border: "1px solid #c7cdd1",
    fontSize: 14,
    boxSizing: "border-box",
    background: "#fff",
    outline: "none",
  },
  previewContainer: {
    background: "#f0f4f7",
    padding: "20px",
    borderRadius: "8px",
    border: "1px dashed #cbd5e0",
  },
  previewMessage: {
    background: "#fff",
    padding: "15px",
    borderRadius: "6px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
    fontSize: 14,
    lineHeight: "1.6",
    color: "#2d3b45",
    minHeight: "100px",
    whiteSpace: "pre-wrap",
  },
  toolbar: {
    display: "flex",
    gap: "4px",
    padding: "8px 12px",
    background: "#fff",
    borderBottom: "1px solid #e1e4e8",
    flexWrap: "wrap",
  },
  toolBtn: {
    background: "none",
    border: "1px solid transparent",
    padding: "6px 10px",
    cursor: "pointer",
    borderRadius: "4px",
    fontSize: "14px",
    color: "#4a5568",
    transition: "all 0.2s",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "32px",
  },
  editorArea: {
    width: "100%",
    height: "300px",
    padding: "20px",
    border: "none",
    fontSize: 15,
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box",
    resize: "vertical",
    lineHeight: "1.6",
    color: "#2d3b45",
  },
  chipContainer: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
  },
  chip: {
    background: "#ebf8ff",
    border: "1px solid #bee3f8",
    padding: "8px 14px",
    borderRadius: "20px",
    fontSize: 12,
    cursor: "pointer",
    color: "#2b6cb0",
    fontWeight: 600,
    transition: "all 0.2s",
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  auditTable: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
  },
  auditRow: {
    borderBottom: "1px solid #edf2f7",
  },
  auditLabel: {
    padding: "12px",
    background: "#f7fafc",
    fontWeight: 600,
    width: "40%",
    color: "#4a5568",
  },
  auditValue: {
    padding: "12px",
    color: "#2d3b45",
  },
  actionArea: {
    marginTop: "auto",
    padding: "20px 30px",
    background: "#fff",
    borderTop: "1px solid #c7cdd1",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  btnPrimary: {
    background: "#0770a3",
    color: "#fff",
    border: "none",
    padding: "10px 24px",
    borderRadius: "4px",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: 14,
    transition: "background 0.2s",
  },
  btnSecondary: {
    background: "#fff",
    border: "1px solid #c7cdd1",
    padding: "10px 24px",
    borderRadius: "4px",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: 14,
    color: "#2d3b45",
  },
  btnDanger: {
    color: "#e53e3e",
    background: "none",
    border: "none",
    textDecoration: "underline",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
  }
};

export default function TemplateEditor({ template, onSave, onClose }) {
  const [name, setName] = useState(template?.name || "Nueva Plantilla de Feedback");
  const [range, setRange] = useState("Rango Bajo: 0-3.9");
  const [content, setContent] = useState(
    template?.content || "Estimado {{nombre_estudiante}},\n\nTu calificación en la actividad ha sido {{calificacion}}.\n\nEl promedio actual del curso es {{promedio_curso}}.\n\nTe sugerimos revisar los siguientes temas..."
  );
  const [preview, setPreview] = useState("");
  const editorRef = useRef(null);

  useEffect(() => {
    // Generate preview
    let text = content
      .replace(/{{nombre_estudiante}}/g, "Juan Pérez")
      .replace(/{{calificacion}}/g, "3.5")
      .replace(/{{promedio_curso}}/g, "5.2");
    setPreview(text);
  }, [content]);

  const insertVariable = (variable) => {
    const editor = editorRef.current;
    if (!editor) return;

    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const text = editor.value;
    const before = text.substring(0, start);
    const after = text.substring(end);
    
    const newContent = before + `{{${variable}}}` + after;
    setContent(newContent);
    
    setTimeout(() => {
      editor.focus();
      editor.setSelectionRange(start + variable.length + 4, start + variable.length + 4);
    }, 0);
  };

  const applyFormat = (format) => {
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
    setContent(before + replacement + after);

    setTimeout(() => {
      editor.focus();
      editor.setSelectionRange(start + replacement.length, start + replacement.length);
    }, 0);
  };

  return (
    <div style={styles.wrapper}>
      <header style={styles.header}>
        <h1 style={styles.title}>
          {template ? "MODIFICAR PLANTILLA DE FEEDBACK" : "CREAR NUEVA PLANTILLA DE FEEDBACK"}
        </h1>
        <div style={styles.breadcrumb}>
          <span>GESTIÓN PLANTILLAS</span>
          <span>/</span>
          <span style={{ color: "#2d3b45", fontWeight: "bold" }}>
            {template ? "EDITAR" : "NUEVA"}
          </span>
        </div>
      </header>

      <main style={styles.main}>
        {/* Left Column: Config & Preview */}
        <section style={styles.leftCol}>
          <div style={styles.card}>
            <div style={styles.cardHeader}>⚙️ CONFIGURACIÓN BÁSICA</div>
            <div style={styles.cardBody}>
              <div style={{ marginBottom: "20px" }}>
                <label style={styles.label}>Nombre de la Plantilla</label>
                <input 
                  style={styles.input} 
                  value={name} 
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Feedback de Refuerzo Semanal"
                />
              </div>
              <div>
                <label style={styles.label}>Rango de Calificación Asociado</label>
                <select style={styles.select} value={range} onChange={(e) => setRange(e.target.value)}>
                  <option>Rango Bajo: 0-3.9</option>
                  <option>Rango Medio: 4.0-5.9</option>
                  <option>Rango Logrado: 6-10</option>
                </select>
              </div>
            </div>
          </div>

          <div style={styles.card}>
            <div style={styles.cardHeader}>👁️ VISTA PREVIA (SIMULADA)</div>
            <div style={styles.cardBody}>
              <div style={styles.previewContainer}>
                <div style={styles.previewMessage}>
                  {preview}
                </div>
              </div>
              <p style={{ fontSize: 11, color: "#718096", marginTop: "12px", fontStyle: "italic" }}>
                * Esta es una simulación de cómo el estudiante verá el feedback en Canvas.
              </p>
            </div>
          </div>
        </section>

        {/* Right Column: Editor & Variables */}
        <section style={styles.rightCol}>
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <span>✍️ EDITOR DE TEXTO INTEGRADO</span>
              <span style={{ fontSize: 11, fontWeight: "normal", color: "#718096" }}>Soporta Markdown Básico</span>
            </div>
            <div style={styles.toolbar}>
              <button style={styles.toolBtn} onClick={() => applyFormat("bold")} title="Negrita"><b>B</b></button>
              <button style={styles.toolBtn} onClick={() => applyFormat("italic")} title="Cursiva"><i>I</i></button>
              <button style={styles.toolBtn} onClick={() => applyFormat("underline")} title="Subrayado"><u>U</u></button>
              <div style={{ width: "1px", background: "#e1e4e8", margin: "0 8px" }} />
              <button style={styles.toolBtn} onClick={() => applyFormat("list")} title="Lista con viñetas">•≡</button>
              <button style={styles.toolBtn} onClick={() => applyFormat("numlist")} title="Lista numerada">1≡</button>
              <div style={{ width: "1px", background: "#e1e4e8", margin: "0 8px" }} />
              <button style={styles.toolBtn} onClick={() => setContent("")} title="Limpiar todo">🗑️</button>
            </div>
            <textarea 
              ref={editorRef}
              style={styles.editorArea}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Escribe tu plantilla aquí..."
            />
          </div>

          <div style={styles.card}>
            <div style={styles.cardHeader}>🧩 VARIABLES DINÁMICAS</div>
            <div style={styles.cardBody}>
              <p style={{ fontSize: 13, color: "#4a5568", marginBottom: "15px" }}>
                Inserta estas etiquetas para que la IA las reemplace con datos reales del curso:
              </p>
              <div style={styles.chipContainer}>
                <div style={styles.chip} onClick={() => insertVariable("nombre_estudiante")}>
                  {"{{nombre_estudiante}}"} ➕
                </div>
                <div style={styles.chip} onClick={() => insertVariable("calificacion")}>
                  {"{{calificacion}}"} ➕
                </div>
                <div style={styles.chip} onClick={() => insertVariable("promedio_curso")}>
                  {"{{promedio_curso}}"} ➕
                </div>
              </div>
            </div>
          </div>

          {template && (
            <div style={styles.card}>
              <div style={styles.cardHeader}>📜 REGISTRO DE AUDITORÍA</div>
              <div style={styles.cardBody}>
                <table style={styles.auditTable}>
                  <tbody>
                    <tr style={styles.auditRow}>
                      <td style={styles.auditLabel}>Última Modificación</td>
                      <td style={styles.auditValue}>14/05/2026 18:10:05</td>
                    </tr>
                    <tr>
                      <td style={styles.auditLabel}>Autor de la Versión</td>
                      <td style={styles.auditValue}>Dr. Elena Ramirez (ID: ER-88)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </main>

      <div style={styles.actionArea}>
        <button style={styles.btnDanger} onClick={() => alert("Función de borrado protegida")}>
          Eliminar esta Plantilla
        </button>
        <div style={{ display: "flex", gap: "12px" }}>
          <button style={styles.btnSecondary} onClick={onClose}>Cancelar Cambios</button>
          <button style={styles.btnPrimary} onClick={() => onSave({ ...template, name, content, ranges: 3 })}>
            {template ? "Actualizar Plantilla" : "Guardar Nueva Plantilla"}
          </button>
        </div>
      </div>

      <StatusFooter lastSync="18:10:00" count={1} label="Editando Plantilla Local" />
    </div>
  );
}
