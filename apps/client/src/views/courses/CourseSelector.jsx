import { useState } from "react";
import WizardProgress from "./WizardProgress";
import { useCourseData } from "./hooks/useCourseData";
import { useAuth } from "../context/AuthContext";
import styles from "./CourseSelector.module.css";

const SKELETON_ROWS = 5;

export default function CourseSelector({
  onCourseSelected,
  userName = "Canvas User",
  onApiError
}) {
  const { courses, loading, error, retrying, retryCountdown, syncTime, usingCache, invalidateCache } = useCourseData(onApiError);
  const { setSelectedCourse, role } = useAuth();
  const [hoverRow, setHoverRow] = useState(null);
  const [hoverBtn, setHoverBtn] = useState(null);

  const handleCourseSelected = (course) => {
    setSelectedCourse(course);
    onCourseSelected(course);
  };

  return (
    <div className={styles.wrapper}>
      <main className={styles.main}>
        <h1 className={styles.pageTitle}>CONFIGURATION — SELECT COURSE</h1>

        {error && (
          <div style={{ background: "#f8d7da", color: "#721c24", padding: "10px", borderRadius: "4px", marginBottom: "20px", border: "1px solid #f5c6cb" }}>
            {error}
          </div>
        )}

        {usingCache && !error && (
          <div style={{ background: "#fff3cd", color: "#856404", padding: "10px", borderRadius: "4px", marginBottom: "20px", border: "1px solid #ffeaa7", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Showing cached data. Last synchronized: {syncTime}</span>
            <button onClick={invalidateCache} style={{ background: "#856404", color: "#fff", border: "none", padding: "6px 12px", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}>
              Refresh
            </button>
          </div>
        )}

        <p className={styles.sectionHeading}>
          ACTIVE COURSES FROM THE CANVAS API
        </p>

        <div className={styles.tableWrapper}>
          <div className={styles.tableHeader}>
            <div className={styles.colNombre}>Course Name</div>
            <div className={styles.colId}>Canvas ID</div>
            <div className={styles.colCodigo}>Term / Code</div>
            <div className={styles.colAccion}>Action</div>
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
                {role === 'admin'
                  ? "No active courses were found associated with your account."
                  : "No active courses were found where you are the Instructor."}
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
                    onClick={() => handleCourseSelected(course)}
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
                      onClick={() => handleCourseSelected(course)}
                    >
                      Select to Apply Plugin
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {retrying && (
          <p style={{ textAlign: "center", color: "#0770a3", marginTop: "15px", fontSize: "13px" }}>
            Retrying connection to the Canvas API... {retryCountdown !== null ? `(${retryCountdown}s)` : ''}
          </p>
        )}

        {!loading && !error && courses.length === 0 && (
          <p style={{ textAlign: "center", color: "#666", marginTop: "15px", fontSize: "13px" }}>
            No courses to display.
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
              Retry Now
            </button>
          </div>
        )}

        <p className={styles.footnote}>
          {role === 'admin'
            ? "Showing active courses associated with your account."
            : "Showing active courses where you are the Instructor."}
        </p>
      </main>

      {/* Bottom sticky bar */}
      <div className={styles.stickyBar}>
        <WizardProgress currentStep={0} />
      </div>
    </div>
  );
}
