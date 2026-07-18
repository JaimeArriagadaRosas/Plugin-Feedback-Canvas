import { useState, useEffect, useRef } from "react";
import { api } from "shared/api";
import WizardProgress from "./WizardProgress";
import StatusFooter from "./StatusFooter";
import logger from "../../utils/logger";

import styles from "./CourseSelector.module.css";

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
  onApiError
}) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const [syncTime, setSyncTime] = useState("---");
  const [hoverRow, setHoverRow] = useState(null);
  const [hoverBtn, setHoverBtn] = useState(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let attempt = 0;
    const MAX_ATTEMPTS = 3;

    const fetchCourses = async () => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      setLoading(true);
      setError(null);
      try {
        const json = await api.get('/courses');

        if (!json.exito) {
          throw new Error(json.error || 'Error al obtener cursos');
        }

        if (cancelled) return;
        const data = json.data || [];
        const filteredCourses = data.filter(c => c.name).map(c => ({
          id: c.id,
          name: c.name,
          term: c.course_code || "N/A"
        }));
        setCourses(filteredCourses);
        setSyncTime(new Date().toLocaleTimeString());
      } catch (err) {
        logger.warn('CourseSelector', "Error al conectar con la API de Canvas.", { error: err });
        if (cancelled) return;
        if (onApiError) {
          onApiError();
          return;
        }
        // Backoff: reintenta con espera creciente antes de mostrar error fatal.
        if (attempt < MAX_ATTEMPTS - 1) {
          attempt += 1;
          setRetrying(true);
          const delay = 1000 * attempt;
          setTimeout(() => { inFlightRef.current = false; fetchCourses(); }, delay);
          return;
        }
        setError("Error al conectar con la API de Canvas. Verifique que el backend tenga un token válido de Canvas.");
      } finally {
        if (!cancelled) setLoading(false);
        inFlightRef.current = false;
      }
    };

    fetchCourses();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className={styles.wrapper}>
      <main className={styles.main}>
        <h1 className={styles.pageTitle}>CONFIGURACIÓN - SELECCIONAR CURSO</h1>

        {error && (
          <div style={{ background: "#f8d7da", color: "#721c24", padding: "10px", borderRadius: "4px", marginBottom: "20px", border: "1px solid #f5c6cb" }}>
            {error}
          </div>
        )}

        <p className={styles.sectionHeading}>
          CURSOS ACTIVOS DE LA API DE CANVAS <span className={styles.sectionHeadingLight}>(Usuario: {userName})</span>
        </p>

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Nombre del Curso</th>
                <th className={styles.th} style={{ width: "15%" }}>ID de Canvas</th>
                <th className={styles.th} style={{ width: "15%" }}>Periodo / Código</th>
                <th className={styles.th} style={{ width: "25%" }}>Acción</th>
              </tr>
            </thead>
            <tbody>
               {loading ? (
                 <tr>
                   <td colSpan={4} style={{ padding: "30px", textAlign: "center", color: "#666" }}>
                     {retrying ? "Reintentando conexión con la API de Canvas..." : "Cargando cursos desde la API de Canvas..."}
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
                    <td className={styles.td}>
                      <button 
                        className={styles.courseLink}
                        onClick={() => onCourseSelected(course)}
                      >
                        {course.name}
                      </button>
                    </td>
                    <td className={styles.td}>{course.id}</td>
                    <td className={styles.td}>{course.term}</td>
                    <td className={styles.td}>
                      <div className={styles.actionCell}>
                        <button
                          className={styles.btnSelect}
                          style={hoverBtn === `sel-${course.id}` ? { background: "#0770a3", color: "#fff" } : {}}
                          onMouseEnter={() => setHoverBtn(`sel-${course.id}`)}
                          onMouseLeave={() => setHoverBtn(null)}
                          onClick={() => onCourseSelected(course)}
                        >
                          Seleccionar para Aplicar Plugin
                        </button>
                        <button 
                          className={styles.btnSettings}
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

        <p className={styles.footnote}>
          Mostrando cursos activos donde usted es el Instructor. Datos obtenidos vía API REST.
        </p>

        <WizardProgress currentStep={0} />
      </main>

      <StatusFooter lastSync={syncTime} count={3} isConnected={!error && courses.length > 0} />
    </div>
  );
}
