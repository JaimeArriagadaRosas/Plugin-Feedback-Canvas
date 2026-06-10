import { useState, useEffect } from "react";
import WizardProgress from "./WizardProgress";
import StatusFooter from "./StatusFooter";

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
  main: {
    padding: "24px 30px",
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: "#2d3b45",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 25,
    borderBottom: "2px solid #2d3b45",
    paddingBottom: "10px",
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: 700,
    color: "#2d3b45",
    marginBottom: 5,
    background: "#eee",
    padding: "10px 15px",
    border: "1px solid #c7cdd1",
  },
  noteBox: {
    background: "#d9edf7",
    color: "#31708f",
    padding: "10px 15px",
    border: "1px solid #bce8f1",
    fontSize: 13,
    marginBottom: 20,
  },
  tableWrapper: {
    background: "#fff",
    border: "1px solid #c7cdd1",
    borderRadius: "4px",
    overflow: "hidden",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
  },
  th: {
    background: "#f0f4f7",
    textAlign: "left",
    padding: "12px 15px",
    fontWeight: 700,
    fontSize: 12,
    color: "#2d3b45",
    borderBottom: "2px solid #c7cdd1",
    borderRight: "1px solid #c7cdd1",
    textTransform: "uppercase",
  },
  td: {
    padding: "12px 15px",
    borderBottom: "1px solid #e0e4e8",
    borderRight: "1px solid #e0e4e8",
    verticalAlign: "middle",
  },
  assignmentLink: {
    color: "#0770a3",
    textDecoration: "underline",
    fontWeight: 600,
  },
  statusIcon: {
    color: "#27ae60",
    fontSize: 18,
    textAlign: "center",
  },
  select: {
    width: "100%",
    padding: "6px",
    borderRadius: "4px",
    border: "1px solid #c7cdd1",
    fontSize: 13,
  },
  toggle: {
    display: "inline-block",
    width: "50px",
    height: "24px",
    background: "#ccc",
    borderRadius: "12px",
    position: "relative",
    cursor: "pointer",
    transition: "background 0.3s",
  },
  toggleOn: {
    background: "#0770a3",
  },
  toggleHandle: {
    width: "20px",
    height: "20px",
    background: "#fff",
    borderRadius: "50%",
    position: "absolute",
    top: "2px",
    left: "2px",
    transition: "left 0.3s",
  },
  toggleHandleOn: {
    left: "28px",
  },
  btnSync: {
    marginTop: "20px",
    background: "#fff",
    border: "1px solid #c7cdd1",
    padding: "8px 15px",
    borderRadius: "4px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: 13,
    fontWeight: 600,
  },
  // Modal styles for RF40
  modalOverlay: {
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
  modalContent: {
    background: "#fff",
    padding: "0",
    borderRadius: "8px",
    width: "450px",
    boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
    overflow: "hidden",
  },
  modalHeader: {
    padding: "15px 20px",
    background: "#f0f4f7",
    borderBottom: "1px solid #c7cdd1",
    fontSize: 16,
    fontWeight: 700,
  },
  modalBody: {
    padding: "20px",
    fontSize: 14,
    lineHeight: "1.5",
  },
  modalFooter: {
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
  },
  toast: {
    position: "fixed",
    bottom: "60px",
    right: "20px",
    background: "#fff",
    border: "1px solid #c7cdd1",
    padding: "12px 20px",
    borderRadius: "8px",
    boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    zIndex: 1100,
  }
};

export default function AssignmentList({ course, onBack, onNext }) {
  const [assignments, setAssignments] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [showToast, setShowToast] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchAssignments = async () => {
    try {
      const response = await fetch(`/api/courses/${course.id}/assignments`, {
        headers: { 'Authorization': 'Bearer dev-token' }
      });
      const result = await response.json();
      if (result.exito && result.data) {
        setAssignments(result.data.map(a => ({
          id: a.id,
          name: a.name,
          due: a.due_at ? new Date(a.due_at).toLocaleDateString() : 'Sin fecha',
          rubric: true, // Assuming mocked to true for now
          template: a.template || "",
          active: a.active || false
        })));
      }
    } catch (e) {
      console.error("Error fetching assignments:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (course && course.id) {
      fetchAssignments();
    }
  }, [course]);

  const handleToggle = (assignment) => {
    if (assignment.active) {
      setSelectedAssignment(assignment);
      setShowModal(true);
    } else {
      updateAssignmentStatus(assignment.id, true);
    }
  };

  const updateAssignmentStatus = async (id, status) => {
    try {
      const response = await fetch(`/api/courses/${course.id}/assignments/${id}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer dev-token' },
        body: JSON.stringify({
          activo: status,
          plantilla_id: 1, // Default template or the one selected
          variables: []
        })
      });
      const result = await response.json();
      if (result.exito) {
        setAssignments(assignments.map(a => a.id === id ? { ...a, active: status } : a));
        if (!status) {
          setShowToast(true);
          setTimeout(() => setShowToast(false), 3000);
        }
      }
    } catch (e) {
      console.error("Error updating status:", e);
    }
  };

  return (
    <div style={styles.wrapper}>
      <main style={styles.main}>
        <h1 style={styles.pageTitle}>CONFIGURACIÓN - LISTADO DE TAREAS</h1>

        <div style={styles.sectionHeading}>
          TAREAS EVALUABLES CON RÚBRICA ASOCIADA (Curso: {course.name})
        </div>



        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                 <th style={styles.th}>Nombre de la Tarea</th>
                <th style={{ ...styles.th, width: "15%" }}>Fecha de Entrega</th>
                <th style={{ ...styles.th, width: "15%", textAlign: "center" }}>Rúbrica Detectada</th>
                <th style={{ ...styles.th, width: "25%" }}>Plantilla Asignada</th>
                <th style={{ ...styles.th, width: "15%", borderRight: "none" }}>Plugin Activo</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((item) => (
                <tr key={item.id}>
                  <td style={styles.td}>
                    <a href="#" style={styles.assignmentLink}>{item.name}</a>
                  </td>
                  <td style={styles.td}>{item.due}</td>
                  <td style={{ ...styles.td, textAlign: "center" }}>
                    <span style={styles.statusIcon}>✔</span>
                  </td>
                  <td style={styles.td}>
                    <select style={styles.select} defaultValue={item.template}>
                      <option value="">Seleccionar plantilla...</option>
                      <option value="Clase Standard">Clase Estándar</option>
                      <option value="Feedback Detallado">Feedback Detallado</option>
                      <option value="Evaluación Cruzada">Evaluación Cruzada</option>
                    </select>
                  </td>
                  <td style={{ ...styles.td, borderRight: "none" }}>
                    <div 
                      style={{ ...styles.toggle, ...(item.active ? styles.toggleOn : {}) }}
                      onClick={() => handleToggle(item)}
                    >
                      <div style={{ ...styles.toggleHandle, ...(item.active ? styles.toggleHandleOn : {}) }} />
                      <span style={{ 
                        position: "absolute", 
                        right: item.active ? "auto" : "8px", 
                        left: item.active ? "8px" : "auto",
                        top: "4px",
                        fontSize: "10px",
                        color: item.active ? "#fff" : "#666",
                        fontWeight: "bold"
                      }}>
                        {item.active ? "Activo" : "Inactivo"}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button style={styles.btnSync}>
          <span>🔄</span> Sincronizar Tareas Ahora
        </button>

        <div style={{ marginTop: "30px", display: "flex", gap: "15px" }}>
          <button style={styles.btnCancel} onClick={onBack}>Volver a Selección de Curso</button>
          <button style={styles.btnConfirm} onClick={onNext}>Continuar a Configuración</button>
        </div>

        <WizardProgress currentStep={1} />
      </main>

      <StatusFooter lastSync="10:35:12" count={assignments.length} label="Cantidad de tareas" isConnected={true} />

      {/* Confirmation Modal (RF40) */}
      {showModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>Confirmar Desactivación del Plugin</div>
            <div style={styles.modalBody}>
              <p>¿Está seguro de que desea desactivar el plugin de feedback para la tarea: <strong>"{selectedAssignment?.name}"</strong>?</p>
              <p style={{ marginTop: "15px", fontSize: "13px", color: "#666" }}>
                <strong>Nota:</strong> Ya se ha seleccionado una plantilla para esta tarea. Todas las entregas de estudiantes sin un feedback generado ya no recibirán uno automáticamente. Ninguna nueva entrega activará un feedback hasta que se reactive.
              </p>
            </div>
            <div style={styles.modalFooter}>
              <button style={styles.btnConfirm} onClick={() => {
                updateAssignmentStatus(selectedAssignment.id, false);
                setShowModal(false);
              }}>Confirmar</button>
              <button style={styles.btnCancel} onClick={() => setShowModal(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Success Toast */}
      {showToast && (
        <div style={styles.toast}>
          <span style={{ color: "#0770a3", fontSize: "18px" }}>ℹ</span>
          <span>Estado RF40 guardado: Plugin desactivado para {selectedAssignment?.name}. Sincronizando configuración...</span>
        </div>
      )}
    </div>
  );
}
