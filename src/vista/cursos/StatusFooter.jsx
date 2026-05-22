import React from 'react';

const styles = {
  statusbar: {
    background: "#fff",
    borderTop: "1px solid #c7cdd1",
    padding: "6px 30px",
    fontSize: 12,
    color: "#2d3b45",
    fontWeight: 600,
    position: "sticky",
    bottom: 0,
    width: "100%",
    zIndex: 1000,
    boxSizing: "border-box",
    marginTop: "auto",
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
      {statusMessage} {label}: {count}
    </footer>
  );
}
