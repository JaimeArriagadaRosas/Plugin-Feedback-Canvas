import React from 'react';

const styles = {
  statusbar: {
    background: "#fff",
    borderTop: "1px solid #ddd",
    padding: "7px 30px",
    fontSize: 12,
    color: "#2d3b45",
    fontWeight: 600,
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
  },
};

export default function StatusFooter({ lastSync = "10:31:05", count = 0, label = "Course count" }) {
  return (
    <footer style={styles.statusbar}>
      Connected to Canvas REST API. Last sync: {lastSync}. {label}: {count}
    </footer>
  );
}
