const styles = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  content: {
    background: "#fff",
    padding: "0",
    borderRadius: "8px",
    width: "400px",
    boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
    overflow: "hidden",
  },
  header: {
    padding: "15px 20px",
    background: "#f0f4f7",
    borderBottom: "1px solid #c7cdd1",
    fontSize: 16,
    fontWeight: 700,
  },
  body: {
    padding: "20px",
    fontSize: 14,
    lineHeight: "1.5",
  },
  footer: {
    padding: "15px 20px",
    textAlign: "right",
    borderTop: "1px solid #eee",
    background: "#f9f9f9",
  },
  btnConfirm: {
    background: "#0770a3",
    color: "#fff",
    border: "none",
    padding: "8px 18px",
    borderRadius: "4px",
    marginRight: "10px",
    cursor: "pointer",
  },
  btnCancel: {
    background: "#fff",
    border: "1px solid #c7cdd1",
    padding: "8px 18px",
    borderRadius: "4px",
    cursor: "pointer",
  }
};

export default function DeleteTemplateModal({ template, onConfirm, onClose }) {
  return (
    <div style={styles.overlay}>
      <div style={styles.content}>
        <div style={styles.header}>Confirmar Eliminación</div>
        <div style={styles.body}>
          <p>¿Está seguro de que desea eliminar la plantilla <strong>"{template?.name}"</strong>?</p>
          <p style={{ marginTop: "10px", color: "#666", fontSize: "13px" }}>Esta acción es irreversible. Se requiere una confirmación según el requerimiento.</p>
        </div>
        <div style={styles.footer}>
          <button style={styles.btnConfirm} onClick={onConfirm}>Confirmar</button>
          <button style={styles.btnCancel} onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
