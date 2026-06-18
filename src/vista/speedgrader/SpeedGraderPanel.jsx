import { useState, useEffect } from "react";

const styles = {
  wrapper: {
    fontFamily: "'Lato', sans-serif",
    fontSize: 14,
    color: "#2d3b45",
    background: "#f5f5f5",
    height: "100vh",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    padding: "15px 30px",
    background: "#fff",
    borderBottom: "1px solid #c7cdd1",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    textTransform: "uppercase",
    margin: 0,
  },
  main: {
    flex: 1,
    display: "flex",
    overflow: "hidden",
    position: "relative",
  },
  canvasDocViewer: {
    flex: 1,
    background: "#fff",
    borderRight: "1px solid #c7cdd1",
    display: "flex",
    flexDirection: "column",
  },
  canvasTopBar: {
    padding: "10px 20px",
    background: "#f9f9f9",
    borderBottom: "1px solid #eee",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 13,
  },
  docContent: {
    flex: 1,
    padding: "40px",
    overflow: "auto",
    background: "#e0e4e7",
    display: "flex",
    justifyContent: "center",
  },
  paper: {
    width: "600px",
    background: "#fff",
    boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
    padding: "50px",
    minHeight: "800px",
  },
  canvasGradingPanel: {
    width: "250px",
    background: "#fff",
    borderRight: "1px solid #c7cdd1",
    padding: "20px",
  },
  gradeBox: {
    border: "1px solid #c7cdd1",
    padding: "15px",
    borderRadius: "4px",
    marginBottom: "20px",
    background: "#f9f9f9",
  },
  inputGrade: {
    width: "60px",
    padding: "5px",
    fontSize: "18px",
    fontWeight: "bold",
    textAlign: "center",
    borderRadius: "4px",
    border: "1px solid #c7cdd1",
  },
  pluginPanel: {
    width: "350px",
    background: "#fff",
    display: "flex",
    flexDirection: "column",
    boxShadow: "-2px 0 10px rgba(0,0,0,0.05)",
  },
  pluginHeader: {
    padding: "12px 15px",
    background: "#f0f4f7",
    borderBottom: "1px solid #c7cdd1",
    fontWeight: 700,
    fontSize: 12,
    textTransform: "uppercase",
  },
  pluginBody: {
    flex: 1,
    padding: "15px",
    overflow: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "15px",
  },
  feedbackPreview: {
    border: "1px solid #c7cdd1",
    borderRadius: "4px",
    padding: "15px",
    fontSize: 13,
    lineHeight: "1.6",
    background: "#fff",
    minHeight: "150px",
    maxHeight: "300px",
    overflow: "auto",
    whiteSpace: "pre-wrap"
  },
  btnAction: {
    background: "#0770a3",
    color: "#fff",
    border: "none",
    padding: "12px",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 700,
    textAlign: "center",
  }
};

// MOCK DATA Fallback
const MOCK_ASSIGNMENTS = [
  { id: 101, name: "Examen Parcial: Arquitectura de Software", points: 100 },
  { id: 102, name: "Proyecto Final: Sistema de Gestión", points: 100 },
  { id: 103, name: "Control 1: Diagramas de Secuencia", points: 20 }
];

const MOCK_STUDENTS = [
  { id: 1, name: "Juan Pérez" },
  { id: 2, name: "María García" },
  { id: 3, name: "Pedro López" },
  { id: 4, name: "Ana Torres" },
  { id: 5, name: "Carlos Méndez" }
];

const MOCK_SUBMISSIONS = {
  101: {
    1: "Análisis de requisitos para el sistema de biblioteca con especificación de casos de uso y diagramas iniciales.",
    2: "Propuesta de arquitectura basada en microservicios, utilizando Spring Boot para el backend y React en el frontend.",
    3: "Diagrama de clases detallado con 15 entidades, relaciones de herencia y agregación especificadas.",
    4: "Evaluación de costos y factibilidad técnica, incluyendo análisis de ROI y estimación de tiempo de desarrollo.",
    5: "Especificación formal de requisitos arquitectónicos, selección justificada de patrones MVC y Observer, y diseño de base de datos relacional robusto."
  },
  102: {
    1: "Código fuente del prototipo de biblioteca y documentación de patrones Factory y Singleton implementados.",
    2: "Documento de arquitectura con diagramas C4 (Contexto, Contenedor, Componente) y especificación de API en OpenAPI.",
    3: "Base de datos implementada en PostgreSQL y scripts de migración con datos semilla precargados.",
    4: "Plan de pruebas automatizadas en Jest y reporte de cobertura de código (88% de cobertura en componentes clave).",
    5: "Despliegue automatizado mediante pipelines CI/CD de GitHub Actions, contenedorización Docker e informe detallado de rendimiento del prototipo final."
  },
  103: {
    1: "Respuestas Control 1: Un diagrama de secuencia representa la interacción de objetos en orden cronológico, mostrando mensajes de llamada y retorno.",
    2: "Respuestas Control 1: La línea de vida en un diagrama de secuencia representa la existencia del objeto a lo largo del tiempo de ejecución.",
    3: "Respuestas Control 1: Un mensaje asíncrono se dibuja con una línea continua y punta de flecha abierta para indicar que no espera respuesta.",
    4: "Respuestas Control 1: Los fragmentos combinados (alt, loop, opt) se usan para representar lógica condicional y bucles en UML.",
    5: "Respuestas Control 1: Un mensaje síncrono bloquea el flujo del emisor hasta que se recibe la respuesta de retorno del receptor."
  }
};

export default function SpeedGraderPanel({ onExit }) {
  const [courseId, setCourseId] = useState(14852);
  const [assignments, setAssignments] = useState(MOCK_ASSIGNMENTS);
  const [students, setStudents] = useState(MOCK_STUDENTS);
  const [submissions, setSubmissions] = useState(MOCK_SUBMISSIONS);
  const [currentAssignmentId, setCurrentAssignmentId] = useState(101);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [grade, setGrade] = useState(7.0);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [generatedFeedbackId, setGeneratedFeedbackId] = useState(null);
  const [statusMsg, setStatusMsg] = useState("Cargando datos desde Canvas...");

  useEffect(() => {
    fetch('/api/config/me')
      .then(res => res.json())
      .then(data => {
        const cId = data.courseId || 14852;
        setCourseId(cId);
        return Promise.all([
          fetch(`/api/courses/${cId}/assignments`).then(r => r.json()),
          fetch(`/api/courses/${cId}/students`).then(r => r.json())
        ]);
      })
      .then(([assignRes, studRes]) => {
        let loadedAssignments = MOCK_ASSIGNMENTS;
        let loadedStudents = MOCK_STUDENTS;
        if (assignRes.exito && assignRes.data && assignRes.data.length > 0) {
          loadedAssignments = assignRes.data.map(a => ({ id: a.id, name: a.name, points: a.points_possible || 100 }));
          setAssignments(loadedAssignments);
          setCurrentAssignmentId(loadedAssignments[0].id);
        }
        if (studRes.exito && studRes.data && studRes.data.length > 0) {
          loadedStudents = studRes.data.map(s => ({ id: s.id, name: s.name || s.short_name }));
          setStudents(loadedStudents);
        }
        setStatusMsg("Listo para generar feedback.");
      })
      .catch(e => {
        console.error(e);
        setStatusMsg("Error cargando datos de Canvas. Usando Mocks.");
      });
  }, []);

  useEffect(() => {
    if (!currentAssignmentId || students.length === 0) return;
    const studentId = students[currentIndex]?.id;
    if (!studentId) return;

    setStatusMsg("Cargando entrega...");
    fetch(`/api/courses/${courseId}/assignments/${currentAssignmentId}/submissions/${studentId}`)
      .then(r => r.json())
      .then(data => {
        if (data.exito && data.data) {
          const body = data.data.body || data.data.preview_url || "Sin contenido de entrega.";
          setSubmissions(prev => ({
            ...prev,
            [currentAssignmentId]: {
              ...(prev[currentAssignmentId] || {}),
              [studentId]: body.replace(/<[^>]+>/g, '')
            }
          }));
          setGrade(data.data.score || 0);
          setStatusMsg("Listo para generar feedback.");
        }
      })
      .catch(() => {
        setStatusMsg("Error cargando entrega. Usando Mock si existe.");
      });
  }, [currentAssignmentId, currentIndex, students, courseId]);

  const currentStudent = students[currentIndex] || { id: 0, name: "Sin Estudiante" };
  const submissionText = submissions[currentAssignmentId]?.[currentStudent.id] || "Sin entrega.";
  const activeAssignment = assignments.find(a => a.id === currentAssignmentId) || assignments[0] || { name: "", points: 100 };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setFeedback("");
      setGeneratedFeedbackId(null);
    }
  };

  const handleNext = () => {
    if (currentIndex < students.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setFeedback("");
      setGeneratedFeedbackId(null);
    }
  };

  const generateFeedback = async () => {
    setLoading(true);
    setStatusMsg("Conectando con el motor de IA...");
    setFeedback("");

    try {
      const response = await fetch('/api/feedback/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          courseId: courseId,
          assignmentId: currentAssignmentId,
          studentId: currentStudent.id,
          templateId: 1,
          grade: grade
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.mensaje || `Error del servidor (${response.status})`);
      }

      const result = await response.json();

      if (result.exito && result.data) {
        setFeedback(result.data.content);
        setGeneratedFeedbackId(result.data.id);
        setStatusMsg("Feedback generado exitosamente.");
      } else {
        throw new Error(result.mensaje || "La respuesta del servidor no tiene el formato esperado.");
      }
    } catch (error) {
      console.error("Error al generar feedback:", error);
      setFeedback(`[ERROR] ${error.message}`);
      setStatusMsg("Error en la generación.");
    } finally {
      setLoading(false);
    }
  };

  const approveFeedback = async () => {
    if (!generatedFeedbackId) return;
    setLoading(true);
    setStatusMsg("Guardando y enviando feedback y nota...");
    try {
      const response = await fetch('/api/feedback/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          feedbackId: generatedFeedbackId,
          courseId: courseId,
          assignmentId: currentAssignmentId,
          studentId: currentStudent.id,
          content: feedback,
          grade: grade
        })
      });

      if (!response.ok) throw new Error("Error al aprobar feedback");
      
      setStatusMsg("¡Enviado exitosamente a Canvas!");
      setGeneratedFeedbackId(null);
    } catch (e) {
      console.error(e);
      setStatusMsg("Error al enviar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      {/* Real Canvas SpeedGrader Header Simulation */}
      <header style={{
        ...styles.header,
        padding: "8px 20px",
        background: "#ffffff",
        borderBottom: "1px solid #c7cdd1",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        height: "56px",
        boxSizing: "border-box"
      }}>
        {/* Left Side: Gradebook Link & Assignment Selector */}
        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          <button 
            style={{ 
              background: "none", 
              border: "none", 
              color: "#0770a3", 
              cursor: "pointer", 
              fontSize: "14px", 
              fontWeight: "600",
              display: "flex",
              alignItems: "center",
              gap: "5px"
            }} 
            onClick={onExit}
          >
            <span>📊</span> Libro de Calificaciones
          </button>
          
          <div style={{ width: "1px", height: "30px", background: "#c7cdd1" }} />
          
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "10px", color: "#666", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Curso: Ingeniería de Software II (ISWII)
            </span>
            <select
              value={currentAssignmentId}
              onChange={(e) => {
                const newAssignId = parseInt(e.target.value);
                setCurrentAssignmentId(newAssignId);
                setFeedback("");
                setGeneratedFeedbackId(null);
                const points = MOCK_ASSIGNMENTS.find(a => a.id === newAssignId)?.points || 100;
                setGrade(points === 20 ? 14.0 : 7.0);
              }}
              style={{
                border: "1px solid #c7cdd1",
                borderRadius: "3px",
                padding: "2px 5px",
                fontSize: "13px",
                fontWeight: "bold",
                color: "#2d3b45",
                background: "#fff",
                outline: "none",
                cursor: "pointer"
              }}
            >
              {assignments.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Right Side: Student Navigation & Dropdown */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", border: "1px solid #c7cdd1", borderRadius: "4px", background: "#f9f9f9" }}>
            <button 
              onClick={handlePrev} 
              disabled={currentIndex === 0} 
              style={{ 
                background: "none", 
                border: "none", 
                borderRight: "1px solid #c7cdd1",
                padding: "6px 12px", 
                cursor: currentIndex === 0 ? "not-allowed" : "pointer",
                fontSize: "16px",
                fontWeight: "bold",
                color: currentIndex === 0 ? "#aaa" : "#2d3b45"
              }}
            >
              ‹
            </button>
            
            <select
              value={currentIndex}
              onChange={(e) => {
                setCurrentIndex(parseInt(e.target.value));
                setFeedback("");
                setGeneratedFeedbackId(null);
              }}
              style={{
                border: "none",
                background: "none",
                padding: "6px 10px",
                fontSize: "13px",
                fontWeight: "600",
                color: "#2d3b45",
                outline: "none",
                cursor: "pointer"
              }}
            >
              {students.map((student, idx) => (
                <option key={student.id} value={idx}>
                  {student.name}
                </option>
              ))}
            </select>

            <button 
              onClick={handleNext} 
              disabled={currentIndex === students.length - 1} 
              style={{ 
                background: "none", 
                border: "none", 
                borderLeft: "1px solid #c7cdd1",
                padding: "6px 12px", 
                cursor: currentIndex === students.length - 1 ? "not-allowed" : "pointer",
                fontSize: "16px",
                fontWeight: "bold",
                color: currentIndex === students.length - 1 ? "#aaa" : "#2d3b45"
              }}
            >
              ›
            </button>
          </div>
          
          <span style={{ fontSize: "12px", color: "#666", fontWeight: "600" }}>
            {currentIndex + 1} de {students.length}
          </span>
          
          <div style={{ width: "1px", height: "30px", background: "#c7cdd1" }} />
          
          <button 
            style={{ 
              background: "#fff", 
              border: "1px solid #c7cdd1", 
              padding: "6px 12px", 
              borderRadius: "4px", 
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: "600",
              color: "#2d3b45"
            }} 
            onClick={onExit}
          >
            Volver al Panel
          </button>
        </div>
      </header>

      <main style={styles.main}>
        <section style={styles.canvasDocViewer}>
          <div style={{
            padding: "8px 20px",
            background: "#f9f9f9",
            borderBottom: "1px solid #eee",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "12px",
            color: "#666"
          }}>
            <div>
              Entregado el: <strong>14 de mayo de 2026, 10:00 AM</strong>
            </div>
            <div>
              Intento: <strong>1 de 1</strong>
            </div>
          </div>
           <div style={styles.docContent}>
             <div style={styles.paper}>
               <h2 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "10px" }}>Entrega: {activeAssignment.name}</h2>
               <p style={{ fontSize: "13px", color: "#666", marginBottom: "20px" }}>Estudiante: <strong>{currentStudent.name}</strong></p>
               <p style={{ marginTop: "30px", lineHeight: "1.8", border: "1px solid #eee", padding: "20px", whiteSpace: "pre-wrap", background: "#fafafa" }}>
                 {submissionText}
               </p>
             </div>
           </div>
        </section>

        <section style={styles.canvasGradingPanel}>
          <div style={{ fontWeight: "bold", marginBottom: "15px", fontSize: 16 }}>Calificación</div>
          <div style={styles.gradeBox}>
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <input type="number" style={styles.inputGrade} value={grade} step="0.1" onChange={(e) => setGrade(parseFloat(e.target.value))} />
              <span style={{ fontSize: "16px", color: "#666", fontWeight: "600" }}>/ {activeAssignment.points}</span>
            </div>
            <div style={{ fontSize: 12, marginTop: "10px", color: "#666" }}>Sincronizado con Canvas</div>
          </div>
        </section>

        <section style={styles.pluginPanel}>
          <div style={styles.pluginHeader}>GENERACIÓN DE FEEDBACK IA</div>
          <div style={styles.pluginBody}>
            <div style={{ fontSize: 12, background: "#fef9e7", padding: "10px", border: "1px solid #f9e79f" }}>
              <strong>Contexto Académico:</strong> La IA analizará la nota actual ({grade}/{activeAssignment.points}), el historial de notas previas y el texto de la entrega.
            </div>

            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={styles.feedbackPreview}>
                {loading ? "🤖 La IA está orquestando los datos académicos y generando feedback..." : (feedback || "Haz clic en 'Generar Feedback' para comenzar.")}
              </div>
            </div>

            <button style={{ ...styles.btnAction, opacity: loading ? 0.6 : 1 }} onClick={generateFeedback} disabled={loading}>
              {loading ? "GENERANDO..." : "1. GENERAR FEEDBACK"}
            </button>
            
            {generatedFeedbackId && (
              <button style={{ ...styles.btnAction, background: "#27ae60", opacity: loading ? 0.6 : 1 }} onClick={approveFeedback} disabled={loading}>
                2. APROBAR Y ENVIAR AL ESTUDIANTE
              </button>
            )}
          </div>
        </section>
      </main>

      <footer style={{ background: "#eee", padding: "5px 30px", fontSize: 11, color: "#666" }}>
        STATUS: {statusMsg} | API: /api/feedback/generate
      </footer>
    </div>
  );
}
