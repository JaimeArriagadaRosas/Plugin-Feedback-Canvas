import { useState, useEffect } from "react";
import CanvasService from "../../servicios/CanvasService";
import WizardProgress from "./WizardProgress";
import StatusFooter from "./StatusFooter";

const CANVAS_BASE_URL = import.meta.env.VITE_CANVAS_BASE_URL;
const CANVAS_ACCESS_TOKEN = import.meta.env.VITE_CANVAS_ACCESS_TOKEN;

const styles = {
  wrapper: {
    fontFamily: "'Lato', 'Helvetica Neue', Arial, sans-serif",
    fontSize: 14,
    color: "#2d3b45",
    background: "transparent",
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
    marginBottom: 15,
  },
  sectionHeadingLight: {
    fontWeight: 400,
    color: "#666",
  },
  tableWrapper: {
    background: "#fff",
    border: "1px solid #c7cdd1",
    borderRadius: "4px",
    overflow: "hidden",
    boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
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
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  td: {
    padding: "12px 15px",
    borderBottom: "1px solid #e0e4e8",
    verticalAlign: "middle",
  },
  courseLink: {
    color: "#0770a3",
    textDecoration: "underline",
    cursor: "pointer",
    background: "none",
    border: "none",
    font: "inherit",
    fontWeight: 600,
    padding: 0,
    textAlign: "left",
  },
  btnSelect: {
    background: "#fff",
    border: "1px solid #0770a3",
    color: "#0770a3",
    padding: "6px 16px",
    fontSize: 13,
    cursor: "pointer",
    borderRadius: "5px",
    fontFamily: "inherit",
    fontWeight: 600,
    transition: "all 0.2s ease",
  },
  btnSettings: {
    background: "#fff",
    border: "1px solid #c7cdd1",
    color: "#555",
    padding: "6px 10px",
    fontSize: 12,
    cursor: "pointer",
    borderRadius: "5px",
    marginLeft: 8,
    verticalAlign: "middle",
    transition: "background 0.2s",
  },
  footnote: {
    textAlign: "right",
    fontSize: 12,
    color: "#666",
    marginTop: 15,
    fontStyle: "italic",
  }
};

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96a6.98 6.98 0 0 0-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.37 1.04.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.57 1.62-.94l2.39.96c.22.08.47 0 .59.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
    </svg>
  );
}

export default function CourseSelector({
  onCourseSelected,
  userName = "Usuario de Canvas",
}) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [syncTime, setSyncTime] = useState("---");
  const [hoverRow, setHoverRow] = useState(null);
  const [hoverBtn, setHoverBtn] = useState(null);

  useEffect(() => {
    const fetchCourses = async () => {
      setLoading(true);
      setError(null);
      try {
        const service = new CanvasService(CANVAS_ACCESS_TOKEN, CANVAS_BASE_URL);
        const data = await service.getCourses();
        const filteredCourses = data.filter(c => c.name).map(c => ({
          id: c.id,
          name: c.name,
          term: c.course_code || "N/A"
        }));
        setCourses(filteredCourses);
        setSyncTime(new Date().toLocaleTimeString());
      } catch (err) {
        setError("Error al conectar con la API de Canvas.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, []);

  return (
    <div style={styles.wrapper}>
      <main style={styles.main}>
        <h1 style={styles.pageTitle}>CONFIGURACIÓN - SELECCIONAR CURSO</h1>

        {error && (
          <div style={{ background: "#f8d7da", color: "#721c24", padding: "10px", borderRadius: "4px", marginBottom: "20px", border: "1px solid #f5c6cb" }}>
            {error}
          </div>
        )}

        <p style={styles.sectionHeading}>
          CURSOS ACTIVOS DE LA API DE CANVAS <span style={styles.sectionHeadingLight}>(Usuario: {userName})</span>
        </p>

        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Nombre del Curso</th>
                <th style={{ ...styles.th, width: "15%" }}>ID de Canvas</th>
                <th style={{ ...styles.th, width: "15%" }}>Periodo / Código</th>
                <th style={{ ...styles.th, width: "25%" }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} style={{ padding: "30px", textAlign: "center", color: "#666" }}>
                    Cargando cursos desde la API de Canvas...
                  </td>
                </tr>
              ) : (
                courses.map((course) => (
                  <tr 
                    key={course.id}
                    onMouseEnter={() => setHoverRow(course.id)}
                    onMouseLeave={() => setHoverRow(null)}
                    style={{ background: hoverRow === course.id ? "#f9fbfc" : "#fff" }}
                  >
                    <td style={styles.td}>
                      <button 
                        style={styles.courseLink}
                        onClick={() => onCourseSelected(course)}
                      >
                        {course.name}
                      </button>
                    </td>
                    <td style={styles.td}>{course.id}</td>
                    <td style={styles.td}>{course.term}</td>
                    <td style={styles.td}>
                      <div style={{ display: "flex", alignItems: "center" }}>
                        <button
                          style={{
                            ...styles.btnSelect,
                            ...(hoverBtn === `sel-${course.id}` ? { background: "#0770a3", color: "#fff" } : {})
                          }}
                          onMouseEnter={() => setHoverBtn(`sel-${course.id}`)}
                          onMouseLeave={() => setHoverBtn(null)}
                          onClick={() => onCourseSelected(course)}
                        >
                          Seleccionar para Aplicar Plugin
                        </button>
                        <button 
                          style={styles.btnSettings}
                          title="Configuración del curso"
                        >
                          <SettingsIcon />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p style={styles.footnote}>
          Mostrando cursos activos donde usted es el Instructor. Datos obtenidos vía API REST.
        </p>

        <WizardProgress currentStep={0} />
      </main>

      <StatusFooter lastSync={syncTime} count={3} isConnected={!error && courses.length > 0} />
    </div>
  );
}
