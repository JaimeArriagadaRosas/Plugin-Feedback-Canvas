import { useState } from "react";
import StatusFooter from "../cursos/StatusFooter";

const styles = {
  wrapper: {
    fontFamily: "'Lato', sans-serif",
    fontSize: 14,
    color: "#2d3b45",
    background: "#f5f5f5",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
  },
  main: {
    flex: 1,
    padding: "24px 30px",
  },
  tabs: {
    display: "flex",
    gap: "2px",
    marginBottom: "20px",
  },
  tab: {
    padding: "10px 25px",
    background: "#eee",
    border: "1px solid #c7cdd1",
    borderBottom: "none",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 13,
    borderRadius: "4px 4px 0 0",
  },
  tabActive: {
    background: "#fff",
    borderBottom: "2px solid #fff",
    color: "#0770a3",
  },
  card: {
    background: "#fff",
    border: "1px solid #c7cdd1",
    borderRadius: "4px",
    padding: "20px",
    marginBottom: "20px",
  },
  cardHeader: {
    padding: "10px 15px",
    background: "#f0f4f7",
    margin: "-20px -20px 20px -20px",
    borderBottom: "1px solid #c7cdd1",
    fontWeight: 700,
    fontSize: 12,
    textTransform: "uppercase",
  },
  row: {
    display: "flex",
    gap: "20px",
    marginBottom: "20px",
  },
  col: {
    flex: 1,
  },
  select: {
    width: "100%",
    padding: "8px",
    borderRadius: "4px",
    border: "1px solid #c7cdd1",
  },
  input: {
    width: "100%",
    padding: "8px",
    borderRadius: "4px",
    border: "1px solid #c7cdd1",
    boxSizing: "border-box",
  },
  statusBox: {
    background: "#e9f7ef",
    border: "1px solid #27ae60",
    padding: "15px",
    borderRadius: "4px",
    color: "#1d8348",
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  box: {
    border: "1px solid #c7cdd1",
    padding: "15px",
    fontSize: 13,
    lineHeight: "1.6",
  },
  flowchart: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "10px",
    marginTop: "10px",
  },
  flowItem: {
    padding: "5px 15px",
    border: "1px solid #666",
    background: "#eee",
    fontSize: 12,
    width: "180px",
    textAlign: "center",
  },
  btnAction: {
    background: "#0770a3",
    color: "#fff",
    border: "none",
    padding: "12px 25px",
    borderRadius: "4px",
    fontWeight: 700,
    cursor: "pointer",
  },
  btnSecondary: {
    background: "#fff",
    border: "1px solid #c7cdd1",
    padding: "12px 25px",
    borderRadius: "4px",
    fontWeight: 700,
    cursor: "pointer",
  }
};

export default function AdminPanel({ onExit }) {
  const [activeTab, setActiveTab] = useState("RF55");
  const [model, setModel] = useState("GPT-4o");
  const [service, setService] = useState("OpenAI");

  return (
    <div style={styles.wrapper}>
      <header style={{ padding: "20px 30px", background: "#fff", borderBottom: "1px solid #c7cdd1" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
            PANEL DE ADMINISTRACIÓN: {activeTab === "RF55" ? "CAPA DE ABSTRACCIÓN IA" : "GESTIÓN DE TOKENS IA"}
          </h1>
          <button style={styles.btnSecondary} onClick={onExit}>Volver al Plugin</button>
        </div>
      </header>

      <main style={styles.main}>
        <div style={styles.tabs}>
          <div style={{ ...styles.tab, ...(activeTab === "RF55" ? styles.tabActive : {}) }} onClick={() => setActiveTab("RF55")}>Configuración Motor IA (RF55)</div>
          <div style={{ ...styles.tab, ...(activeTab === "RF56" ? styles.tabActive : {}) }} onClick={() => setActiveTab("RF56")}>Gestión de Tokens IA (RF56)</div>
        </div>

        {activeTab === "RF55" && (
          <div>
            <div style={styles.card}>
              <div style={styles.cardHeader}>CONFIGURACIÓN DE MOTOR DE IA (RF55)</div>
              <div style={styles.row}>
                <div style={styles.col}>
                  <label style={{ fontWeight: 700, display: "block", marginBottom: "8px" }}>Cambiar de Modelo de Lenguaje (RF55)</label>
                  <select style={styles.select} value={model} onChange={(e) => setModel(e.target.value)}>
                    <option>GPT-4o</option>
                    <option>Claude 3.5 Opus</option>
                    <option>Gemini 1.5 Pro</option>
                    <option>GPT-3.5 Turbo</option>
                  </select>
                </div>
                <div style={styles.col}>
                  <div style={styles.statusBox}>
                    <span style={{ fontSize: 20 }}>✔</span>
                    Capa de Abstracción RF55: Activa
                  </div>
                  <div style={{ fontSize: 11, color: "#666", marginTop: "5px" }}>(image_2.png) Oputater: central central y mi panel</div>
                </div>
              </div>
            </div>

            <div style={styles.row}>
              <div style={styles.col}>
                <div style={styles.card}>
                  <div style={styles.cardHeader}>DETALLES DE ABSTRACCIÓN RF55</div>
                  <div style={styles.box}>
                    <strong>Configuración Actual:</strong> {model}<br/>
                    <strong>Última Sincronización:</strong> 06/05/2026 16:10:05<br/>
                    <strong>Audit ID:</strong> AI55-40 (connección to anverious arlo image logic)
                  </div>
                </div>
              </div>
              <div style={styles.col}>
                <div style={styles.card}>
                  <div style={styles.cardHeader}>LÓGICA DE NEGOCIO (Estándar)</div>
                  <div style={styles.flowchart}>
                    <div style={styles.flowItem}>[Lógica de Plantillas]</div>
                    <div style={{ fontSize: 10 }}>↓</div>
                    <div style={styles.flowItem}>[Lógica de Trayectoria RF05]</div>
                    <div style={{ fontSize: 10 }}>↓</div>
                    <div style={styles.flowItem}>[Rango de Nota RF03]</div>
                    <div style={{ fontSize: 10 }}>↓</div>
                    <div style={{ ...styles.flowItem, background: "#fff", borderColor: "#0770a3", fontWeight: 700 }}>[Capa de Abstracción RF55: {model}]</div>
                  </div>
                  <p style={{ fontSize: 11, textAlign: "center", marginTop: "15px", fontStyle: "italic" }}>
                    Lógica de Negocio no modificada por el cambio de modelo. (RF55 Abstracción Activa)
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "RF56" && (
          <div>
            <div style={styles.card}>
              <div style={styles.cardHeader}>GESTIÓN DE TOKENS IA (RF56)</div>
              <div style={styles.row}>
                <div style={{ flex: "0 0 400px" }}>
                  <div style={{ marginBottom: "15px" }}>
                    <label style={{ fontWeight: 700, display: "block", marginBottom: "8px" }}>Cambiar de Servicio IA (RF56)</label>
                    <select style={styles.select} value={service} onChange={(e) => setService(e.target.value)}>
                      <option>OpenAI</option>
                      <option>Claude (Anthropic)</option>
                      <option>Gemini (Google)</option>
                    </select>
                  </div>
                  <div style={{ marginBottom: "15px" }}>
                    <label style={{ fontWeight: 700, display: "block", marginBottom: "8px" }}>Ingresar Nueva Llave API o Token</label>
                    <input type="password" style={styles.input} placeholder="sk-........................" />
                    <div style={{ fontSize: 11, color: "#666", marginTop: "5px" }}>Tokens existentes no se muestran. Ingrese uno nuevo para actualizar.</div>
                  </div>
                  <div style={{ marginBottom: "15px" }}>
                    <strong>Tokens Almacenados Cifrados (RF56):</strong> <span style={{ color: "#27ae60" }}>✔ Sí (OpenAI, Claude, Gemini)</span>
                  </div>
                  <div style={{ background: "#eee", padding: "10px", borderRadius: "4px" }}>
                    <strong>Estado de Token {service}:</strong> Activo, Cifrado
                  </div>
                </div>
                <div style={styles.col}>
                  <div style={{ border: "1px solid #c7cdd1", borderRadius: "4px" }}>
                    <div style={{ background: "#f0f4f7", padding: "10px", fontWeight: 700, fontSize: 11 }}>EXPOSICIÓN EN LOGS (Seguridad RF56)</div>
                    <div style={{ padding: "15px", fontSize: 12 }}>
                      <div style={{ fontWeight: 700, marginBottom: "5px" }}>Logs del Sistema (NO EXPUESTOS):</div>
                      <div style={{ color: "#c0392b" }}>✘ Tokens de API</div>
                      <div style={{ color: "#c0392b" }}>✘ Contraseñas</div>
                      
                      <div style={{ fontWeight: 700, marginBottom: "5px", marginTop: "15px" }}>Logs del Sistema (SÍ EXPUESTOS):</div>
                      <div style={{ color: "#27ae60" }}>✔ IDs de Usuario</div>
                      <div style={{ color: "#27ae60" }}>✔ Fechas/Horas</div>
                      <div style={{ color: "#27ae60" }}>✔ Nombres de Modelo (e.g., GPT-4o)</div>
                      <div style={{ color: "#27ae60" }}>✔ Acciones - Token Actualizado {service}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: "#666" }}>
              <strong>RF56:</strong> El cambio de token se registra con fecha, hora e ID de usuario. Se cifra en base de datos. No se expone en logs.
            </div>
          </div>
        )}

        <div style={{ marginTop: "30px", textAlign: "right", display: "flex", justifyContent: "flex-end", gap: "15px" }}>
          <button style={styles.btnSecondary}>Descartar Cambios</button>
          <button style={styles.btnAction}>Sincronizar y Actualizar Motor de IA Now</button>
        </div>
      </main>

      <StatusFooter 
        lastSync="11:45:01" 
        count={0} 
        label={`Capa de Administración Activa. Modelo: ${model}. Audit Trail RF26/RF55/RF56 Sincronizado.`} 
      />
    </div>
  );
}
