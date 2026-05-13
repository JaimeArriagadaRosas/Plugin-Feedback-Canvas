import { useState, useEffect, useRef } from "react";

const styles = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "#f5f5f5",
    zIndex: 1000,
    display: "flex",
    flexDirection: "column",
    fontFamily: "'Lato', sans-serif",
  },
  header: {
    padding: "20px 30px",
    background: "#fff",
    borderBottom: "1px solid #c7cdd1",
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: "#2d3b45",
    textTransform: "uppercase",
    margin: 0,
  },
  progress: {
    display: "flex",
    gap: "20px",
    marginTop: "10px",
    fontSize: 13,
    color: "#888",
  },
  main: {
    flex: 1,
    padding: "30px",
    display: "flex",
    gap: "30px",
    overflow: "auto",
  },
  leftCol: {
    flex: "0 0 350px",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  rightCol: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  card: {
    background: "#fff",
    border: "1px solid #c7cdd1",
    borderRadius: "4px",
    overflow: "hidden",
  },
  cardHeader: {
    padding: "10px 15px",
    background: "#f0f4f7",
    borderBottom: "1px solid #c7cdd1",
    fontWeight: 700,
    fontSize: 13,
    color: "#2d3b45",
    textTransform: "uppercase",
  },
  cardBody: {
    padding: "15px",
  },
  label: {
    display: "block",
    fontWeight: 700,
    marginBottom: "8px",
    fontSize: 13,
  },
  input: {
    width: "100%",
    padding: "10px",
    borderRadius: "4px",
    border: "1px solid #c7cdd1",
    fontSize: 14,
    boxSizing: "border-box",
  },
  select: {
    width: "100%",
    padding: "10px",
    borderRadius: "4px",
    border: "1px solid #c7cdd1",
    fontSize: 14,
    boxSizing: "border-box",
    background: "#fff",
  },
  previewBox: {
    background: "#eee",
    padding: "15px",
    borderRadius: "4px",
    fontSize: 13,
    lineHeight: "1.6",
    color: "#555",
    minHeight: "100px",
  },
  toolbar: {
    display: "flex",
    gap: "5px",
    padding: "8px",
    background: "#f9f9f9",
    borderBottom: "1px solid #eee",
  },
  toolBtn: {
    background: "none",
    border: "1px solid transparent",
    padding: "5px 8px",
    cursor: "pointer",
    borderRadius: "3px",
    fontSize: 16,
    color: "#555",
  },
  editorArea: {
    width: "100%",
    height: "250px",
    padding: "15px",
    border: "none",
    fontSize: 15,
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box",
    resize: "none",
  },
  chipContainer: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    marginTop: "10px",
  },
  chip: {
    background: "#f0f4f7",
    border: "1px solid #c7cdd1",
    padding: "6px 12px",
    borderRadius: "20px",
    fontSize: 12,
    cursor: "pointer",
    color: "#0770a3",
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    gap: "5px",
  },
  auditTable: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
  },
  auditTd: {
    padding: "8px 12px",
    border: "1px solid #eee",
  },
  auditLabel: {
    background: "#f9f9f9",
    fontWeight: 600,
    width: "40%",
  },
  footer: {
    padding: "20px 30px",
    background: "#fff",
    borderTop: "1px solid #c7cdd1",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  btnGroup: {
    display: "flex",
    gap: "15px",
  },
  btnPrimary: {
    background: "#0770a3",
    color: "#fff",
    border: "none",
    padding: "10px 25px",
    borderRadius: "4px",
    cursor: "pointer",
    fontWeight: "bold",
  },
  btnSecondary: {
    background: "#fff",
    border: "1px solid #c7cdd1",
    padding: "10px 25px",
    borderRadius: "4px",
    cursor: "pointer",
    fontWeight: "bold",
  },
  btnDanger: {
    color: "#c0392b",
    background: "none",
    border: "none",
    textDecoration: "underline",
    cursor: "pointer",
    fontSize: 13,
  }
};

export default function TemplateEditor({ template, onSave, onClose }) {
  const [name, setName] = useState(template?.name || "Feedback Recuperatorio 1");
  const [range, setRange] = useState("Rango Bajo: 0-3.9");
  const [content, setContent] = useState(
    "Estimado {{nombre_estudiante}},\n\nTu calificación en la actividad ha sido {{calificacion}}.\n\nEl promedio actual del curso es {{promedio_curso}}.\n\nTe sugerimos revisar los siguientes temas..."
  );
  const [preview, setPreview] = useState("");
  const editorRef = useRef(null);

  useEffect(() => {
    // Generate preview
    let text = content
      .replace(/{{nombre_estudiante}}/g, "[Juan Pérez]")
      .replace(/{{calificacion}}/g, "[3.5]")
      .replace(/{{promedio_curso}}/g, "[5.2]");
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
    
    // Reset focus and cursor position (simplified)
    setTimeout(() => {
      editor.focus();
      editor.setSelectionRange(start + variable.length + 4, start + variable.length + 4);
    }, 0);
  };

  return (
    <div style={styles.overlay}>
      <header style={styles.header}>
        <h1 style={styles.title}>
          {template ? "MODIFICAR PLANTILLA DE FEEDBACK EXISTENTE" : "CREAR / EDITAR PLANTILLA DE FEEDBACK"}
        </h1>
        <div style={styles.progress}>
          <span>(0) GESTIÓN PLANTILLAS [completado]</span>
          <span style={{ fontWeight: "bold", color: "#2d3b45" }}>(1) {template ? "MODIFICAR" : "CREAR/EDITAR"} [activo]</span>
        </div>
      </header>

      <main style={styles.main}>
        {/* Left Column: Basic Config */}
        <section style={styles.leftCol}>
          <div style={styles.card}>
            <div style={styles.cardHeader}>CONFIGURACIÓN BÁSICA</div>
            <div style={styles.cardBody}>
              <div style={{ marginBottom: "20px" }}>
                <label style={styles.label}>Nombre de la Plantilla</label>
                <input 
                  style={styles.input} 
                  value={name} 
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div style={{ marginBottom: "20px" }}>
                <label style={styles.label}>Rango de Calificación (Opcional)</label>
                <select style={styles.select} value={range} onChange={(e) => setRange(e.target.value)}>
                  <option>Rango Bajo: 0-3.9</option>
                  <option>Rango Medio: 4.0-5.9</option>
                  <option>Rango Logrado: 6-10</option>
                </select>
              </div>
            </div>
          </div>

          <div style={styles.card}>
            <div style={styles.cardHeader}>VISTA PREVIA (Simulada)</div>
            <div style={styles.cardBody}>
              <div style={styles.previewBox}>
                {preview.split('\n').map((line, i) => (
                  <div key={i} style={{ minHeight: "1.2em" }}>{line}</div>
                ))}
              </div>
            </div>
          </div>
          
          <button style={{ ...styles.btnSecondary, display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}>
            🔄 Sync Assignments Now
          </button>
        </section>

        {/* Right Column: Editor */}
        <section style={styles.rightCol}>
          <div style={styles.card}>
            <div style={styles.cardHeader}>EDITOR DE TEXTO INTEGRADO</div>
            <div style={styles.toolbar}>
              <button style={styles.toolBtn}><b>B</b></button>
              <button style={styles.toolBtn}><i>I</i></button>
              <button style={styles.toolBtn}><u>U</u></button>
              <div style={{ width: "1px", background: "#ddd", margin: "0 5px" }} />
              <button style={styles.toolBtn}>•≡</button>
              <button style={styles.toolBtn}>1≡</button>
              <button style={styles.toolBtn}>≡</button>
              <div style={{ width: "1px", background: "#ddd", margin: "0 5px" }} />
              <button style={styles.toolBtn}>↩</button>
              <button style={styles.toolBtn}>↪</button>
            </div>
            <textarea 
              ref={editorRef}
              style={styles.editorArea}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>

          <div style={styles.card}>
            <div style={styles.cardHeader}>VARIABLES DINÁMICAS DISPONIBLES</div>
            <div style={styles.cardBody}>
              <p style={{ fontSize: 12, color: "#666", marginBottom: "10px" }}>Haga clic para insertar en el cursor del editor.</p>
              <div style={styles.chipContainer}>
                <div style={styles.chip} onClick={() => insertVariable("nombre_estudiante")}>
                  {"{{nombre_estudiante}}"} 📋
                </div>
                <div style={styles.chip} onClick={() => insertVariable("calificacion")}>
                  {"{{calificacion}}"} 📋
                </div>
                <div style={styles.chip} onClick={() => insertVariable("promedio_curso")}>
                  {"{{promedio_curso}}"} 📋
                </div>
              </div>
            </div>
          </div>

          {template && (
            <div style={styles.card}>
              <div style={styles.cardHeader}>REGISTRO DE AUDITORÍA (Solo Lectura - Obtenido de BD Local)</div>
              <div style={styles.cardBody}>
                <table style={styles.auditTable}>
                  <tbody>
                    <tr>
                      <td style={{ ...styles.auditTd, ...styles.auditLabel }}>Última Modificación:</td>
                      <td style={styles.auditTd}>05/05/2026 15:45:12</td>
                    </tr>
                    <tr>
                      <td style={{ ...styles.auditTd, ...styles.auditLabel }}>Usuario que realizó el cambio:</td>
                      <td style={styles.auditTd}>Profr. Elena Ramirez - ID: ER45</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </main>

      <footer style={styles.footer}>
        <button style={styles.btnDanger}>Eliminar Plantilla (¡Cuidado!)</button>
        <div style={styles.btnGroup}>
          <button style={styles.btnSecondary} onClick={onClose}>Cancelar</button>
          <button style={styles.btnPrimary} onClick={() => onSave({ ...template, name, ranges: 3 })}>
            {template ? "Actualizar Registro" : "Guardar Plantilla"}
          </button>
        </div>
      </footer>
    </div>
  );
}
