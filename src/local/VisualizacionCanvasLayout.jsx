import React from "react";

const styles = {
  container: {
    display: "flex",
    height: "100vh",
    width: "100vw",
    overflow: "hidden",
    fontFamily: "'Lato', sans-serif",
  },
  // Far left dark sidebar (Canvas Global Nav)
  canvasGlobalNav: {
    width: "84px",
    background: "#2d3b45",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    paddingTop: "10px",
    color: "#fff",
    gap: "15px",
    flexShrink: 0,
  },
  iconBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "2px",
    fontSize: "11px",
    cursor: "pointer",
    width: "100%",
    padding: "10px 0",
    transition: "background 0.2s",
  },
  activeGlobal: {
    background: "#fff",
    color: "#2d3b45",
  },
  // Second sidebar (Course/Plugin Nav)
  courseNav: {
    width: "200px",
    background: "#fff",
    borderRight: "1px solid #c7cdd1",
    display: "flex",
    flexDirection: "column",
    paddingTop: "20px",
    flexShrink: 0,
  },
  navItem: {
    padding: "10px 20px",
    fontSize: "15px",
    color: "#0770a3", // Canvas link color
    cursor: "pointer",
    borderLeft: "4px solid transparent",
  },
  navItemActive: {
    color: "#2d3b45",
    fontWeight: "bold",
    borderLeftColor: "#2d3b45",
  },
  content: {
    flex: 1,
    overflow: "auto",
    background: "#f5f5f5",
    display: "flex",
    flexDirection: "column",
  }
};

export default function VisualizacionCanvasLayout({ children, isStudentView = false }) {
  const teacherLinks = [
    "Inicio",
    "Anuncios",
    "Tareas",
    "Foros de discusión",
    "Calificaciones",
    "Personas",
    "Páginas",
    "Archivos",
    "Programa del curso",
    "Resultados",
    "Evaluaciones",
    "Módulos",
    "Conferencias",
    "Colaboraciones",
    "Chat",
    "Configuraciones"
  ];

  const studentLinks = [
    "Inicio",
    "Anuncios",
    "Tareas",
    "Foros de discusión",
    "Calificaciones",
    "Personas",
    "Páginas",
    "Archivos",
    "Programa del curso",
    "Evaluaciones",
    "Módulos",
    "Colaboraciones"
  ];

  const links = isStudentView ? studentLinks : teacherLinks;

  return (
    <div style={styles.container}>
      {/* 1. Canvas Global Navigation Simulation */}
      <nav style={styles.canvasGlobalNav}>
        <div style={{ ...styles.iconBox, opacity: 1 }}>
          <span style={{ fontSize: "24px" }}>🏢</span>
          <span>UNIDA</span>
        </div>
        <div style={styles.iconBox}>
          <span style={{ fontSize: "24px" }}>🏠</span>
          <span>Inicio</span>
        </div>
        <div style={styles.iconBox}>
          <span style={{ fontSize: "24px" }}>👤</span>
          <span>Cuenta</span>
        </div>
        <div style={{ ...styles.iconBox, color: "#000", background: "#fff", width: "100%", padding: "10px 0" }}>
          <span style={{ fontSize: "24px" }}>📚</span>
          <span>Cursos</span>
        </div>
        <div style={styles.iconBox}>
          <span style={{ fontSize: "24px" }}>👥</span>
          <span>Grupos</span>
        </div>
        <div style={styles.iconBox}>
          <span style={{ fontSize: "24px" }}>📅</span>
          <span>Calendario</span>
        </div>
        <div style={styles.iconBox}>
          <span style={{ fontSize: "24px" }}>📥</span>
          <span>Bandeja</span>
        </div>
        <div style={styles.iconBox}>
          <span style={{ fontSize: "24px" }}>❓</span>
          <span>Ayuda</span>
        </div>
      </nav>

      {/* 2. Course Navigation Simulation (Dynamic based on Role) */}
      <nav style={styles.courseNav}>
        {links.map((link) => {
          const isActive = isStudentView && link === "Calificaciones";
          return (
            <div 
              key={link} 
              style={{
                ...styles.navItem,
                ...(isActive ? styles.navItemActive : {})
              }}
            >
              {link}
            </div>
          );
        })}
        {!isStudentView && (
          <div style={{ ...styles.navItem, ...styles.navItemActive }}>
            UNIDA Plugin de Feedback
          </div>
        )}
      </nav>

      {/* 3. Main Content Area (where the plugin visualizaci�n lives) */}
      <main style={styles.content}>
        {children}
      </main>
    </div>
  );
}
