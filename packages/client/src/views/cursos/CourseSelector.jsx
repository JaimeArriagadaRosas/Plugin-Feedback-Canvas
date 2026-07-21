import { useState } from "react";
import WizardProgress from "./WizardProgress";
import { useCourseData } from "./hooks/useCourseData";
import styles from "./CourseSelector.module.css";

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96a6.98 6.98 0 0 0-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.22.22 0 0 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96a6.98 6.98 0 0 0 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.57 1.62-.94l2.39.96a.22.22 0 0 0 .59-.22l1.92-3.32a.49.49 0 0 0-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6-3.6z" />
    </svg>
  );
}

const SKELETON_ROWS = 5;

export default function CourseSelector({
  onCourseSelected,
  userName = "Usuario de Canvas",
  onApiError
}) {
  const { courses, loading, error, retrying, retryCountdown, syncTime, usingCache, invalidateCache } = useCourseData(onApiError);
  const [hoverRow, setHoverRow] = useState(null);
  const [hoverBtn, setHoverBtn] = useState(null);

  return (
    <div className={styles.wrapper}>
      <main className={styles.main}>
        <h1 className={styles.pageTitle}>CONFIGURACIÓN - SELECCIONAR CURSO</h1>

        {error && (
          <div style={{ background: "#f8d7da", color: "#721c24", padding: "10px", borderRadius: "4px", marginBottom: "20px", border: "1px solid #f5c6cb" }}>
            {error}
          </div>
        )}

        {usingCache && !error && (
          <div style={{ background: "#fff3cd", color: "#856404", padding: "10px", borderRadius: "4px", marginBottom: "20px", border: "1px solid #ffeaa7", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Mostrando datos guardados. Última sincronización: {syncTime}</span>
            <button onClick={invalidateCache} style={{ background: "#856404", color: "#fff", border: "none", padding: "6px 12px", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}>
              Actualizar
            </button>
          </div>
        )}

        <p className={styles.sectionHeading}>
          CURSOS ACTIVOS DE LA API DE CANVAS
        </p>

        <div className={styles.tableWrapper}>
          <div className={styles.tableHeader}>
            <div className={styles.colNombre}>Nombre del Curso</div>
            <div className={styles.colId}>ID de Canvas</div>
            <div className={styles.colCodigo}>Periodo / Código</div>
            <div className={styles.colAccion}>Acción</div>
          </div>

          <div className={styles.tableBody}>
            {loading ? (
              Array.from({ length: SKELETON_ROWS }).map((_, idx) => (
                <div key={idx} className={styles.tableRow}>
                  <div className={`${styles.colNombre} ${styles.skeletonCell} ${styles.skeletonCellLong}`} />
                  <div className={`${styles.colId} ${styles.skeletonCell} ${styles.skeletonCellMedium}`} />
                  <div className={`${styles.colCodigo} ${styles.skeletonCell} ${styles.skeletonCellShort}`} />
                  <div className={`${styles.colAccion} ${styles.skeletonCell} ${styles.skeletonCellMedium}`} />
                </div>
              ))
            ) : courses.length === 0 ? (
              <div className={styles.emptyState}>
                No se encontraron cursos activos donde usted es el Instructor.
              </div>
            ) : (
              courses.map((course) => (
                <div
                  key={course.id}
                  className={styles.tableRow}
                  onMouseEnter={() => setHoverRow(course.id)}
                  onMouseLeave={() => setHoverRow(null)}
                >
                  <div className={styles.colNombre}>
                    <button
                      className={styles.courseLink}
                      onClick={() => onCourseSelected(course)}
                    >
                      {course.name}
                    </button>
                  </div>
                  <div className={`${styles.colId} ${styles.cellText}`}>{course.id}</div>
                  <div className={`${styles.colCodigo} ${styles.cellText}`}>{course.term}</div>
                  <div className={`${styles.colAccion} ${styles.actionCell}`}>
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
                </div>
              ))
            )}
          </div>
        </div>

        {retrying && (
          <p style={{ textAlign: "center", color: "#0770a3", marginTop: "15px", fontSize: "13px" }}>
            Reintentando conexión con la API de Canvas... {retryCountdown !== null ? `(${retryCountdown}s)` : ''}
          </p>
        )}

        {!loading && !error && courses.length === 0 && (
          <p style={{ textAlign: "center", color: "#666", marginTop: "15px", fontSize: "13px" }}>
            No hay cursos para mostrar.
          </p>
        )}

        {error && !retrying && (
          <div style={{ textAlign: "center", marginTop: "15px" }}>
            <button
              onClick={() => {
                invalidateCache();
                window.location.reload();
              }}
              style={{ background: "#0770a3", color: "#fff", border: "none", padding: "10px 20px", borderRadius: "4px", cursor: "pointer", fontWeight: "600", fontSize: "14px" }}
            >
              Reintentar ahora
            </button>
          </div>
        )}

        <p className={styles.footnote}>
          Mostrando cursos activos donde usted es el Instructor.
        </p>
      </main>

      {/* Barra sticky inferior */}
      <div className={styles.stickyBar}>
        <WizardProgress currentStep={0} />
      </div>
    </div>
  );
}
