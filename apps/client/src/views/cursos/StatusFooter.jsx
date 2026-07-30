import React from 'react';

const styles = {
  statusbar: {
    background: "#fff",
    borderTop: "1px solid #c7cdd1",
    padding: "6px 30px",
    fontSize: 12,
    color: "#2d3b45",
    fontWeight: 600,
    position: "fixed",
    bottom: 0,
    left: 0,
    width: "100%",
    zIndex: 9999,
    boxSizing: "border-box",
  }
};

export default function StatusFooter({ 
  lastSync = "---", 
  count = 0,
  label = "Plantillas locales",
  isConnected = false 
}) {
  const statusMessage = isConnected 
    ? `Conectado a la API REST de Canvas. Última sincronización: ${lastSync}.` 
    : "La API REST de Canvas no está disponible actualmente.";

  return (
    <footer style={styles.statusbar}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        <span>{statusMessage}</span>
        <span>{label}: {count}</span>
      </div>
    </footer>
  );
}
