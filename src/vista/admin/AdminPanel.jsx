import { useState } from "react";
import StatusFooter from "../cursos/StatusFooter";

const styles = {
  wrapper: {
    fontFamily: "'Lato', sans-serif",
    fontSize: 14,
    color: "#2d3b45",
    background: "#f5f5f5",
    minHeight: "100%",
    display: "flex",
    flexDirection: "column",
  },
  main: {
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

  // Parámetros del motor de IA (CU54)
  const [temperature, setTemperature] = useState(0.7);
  const [maxLength, setMaxLength] = useState(2048);
  const [endpoint, setEndpoint] = useState("https://api.openai.com/v1/chat/completions");
  const [validationError, setValidationError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSaveConfig = () => {
    setValidationError("");
    setSaveSuccess(false);

    // Validar Temperatura (debe ser un número entre 0.0 y 2.0)
    const tempNum = parseFloat(temperature);
    if (isNaN(tempNum) || tempNum < 0.0 || tempNum > 2.0) {
      setValidationError("La temperatura debe ser un valor numérico entre 0.0 y 2.0 (Excepción 1).");
      return;
    }

    // Validar Longitud Máxima (debe ser un entero entre 1 y 4096)
    const maxTokens = parseInt(maxLength, 10);
    if (isNaN(maxTokens) || maxTokens < 1 || maxTokens > 4096) {
      setValidationError("La longitud máxima (tokens) debe ser un entero entre 1 y 4096 (Excepción 1).");
      return;
    }

    // Validar Endpoint (debe ser una URL válida)
    if (!endpoint || (!endpoint.startsWith("http://") && !endpoint.startsWith("https://"))) {
      setValidationError("El endpoint debe ser una dirección URL válida que comience con http:// o https:// (Excepción 1).");
      return;
    }

    // Si pasa todas las validaciones
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 4000);
  };

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
          <div style={{ ...styles.tab, ...(activeTab === "RF55" ? styles.tabActive : {}) }} onClick={() => setActiveTab("RF55")}>Configuración Motor IA</div>
          <div style={{ ...styles.tab, ...(activeTab === "RF56" ? styles.tabActive : {}) }} onClick={() => setActiveTab("RF56")}>Gestión de Tokens IA</div>
        </div>

        {activeTab === "RF55" && (
          <div>
            <div style={styles.card}>
              <div style={styles.cardHeader}>CONFIGURACIÓN DE MOTOR DE IA</div>
              
              {validationError && (
                <div style={{
                  background: "#fdedec",
                  border: "1px solid #c0392b",
                  padding: "12px 15px",
                  borderRadius: "4px",
                  color: "#922b21",
                  fontWeight: "bold",
                  marginBottom: "15px",
                  fontSize: "13px"
                }}>
                  ⚠️ Error de Validación: {validationError}
                </div>
              )}

              {saveSuccess && (
                <div style={{
                  background: "#e9f7ef",
                  border: "1px solid #27ae60",
                  padding: "12px 15px",
                  borderRadius: "4px",
                  color: "#1d8348",
                  fontWeight: "bold",
                  marginBottom: "15px",
                  fontSize: "13px"
                }}>
                  ✅ ¡Configuración guardada exitosamente! Los nuevos parámetros se aplicaron al motor de IA.
                </div>
              )}

              <div style={styles.row}>
                <div style={styles.col}>
                  <label style={{ fontWeight: 700, display: "block", marginBottom: "8px" }}>Cambiar de Modelo de Lenguaje</label>
                  <select style={styles.select} value={model} onChange={(e) => {
                    setModel(e.target.value);
                    // Actualizar endpoint sugerido basado en el modelo
                    if (e.target.value === "GPT-4o" || e.target.value === "GPT-3.5 Turbo") {
                      setEndpoint("https://api.openai.com/v1/chat/completions");
                    } else if (e.target.value === "Claude 3.5 Opus") {
                      setEndpoint("https://api.anthropic.com/v1/messages");
                    } else if (e.target.value === "Gemini 1.5 Pro") {
                      setEndpoint("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro");
                    }
                  }}>
                    <option>GPT-4o</option>
                    <option>Claude 3.5 Opus</option>
                    <option>Gemini 1.5 Pro</option>
                    <option>GPT-3.5 Turbo</option>
                  </select>
                </div>
                <div style={styles.col}>
                  <label style={{ fontWeight: 700, display: "block", marginBottom: "8px" }}>Temperatura (0.0 a 2.0)</label>
                  <input 
                    type="number" 
                    step="0.1" 
                    style={styles.input} 
                    value={temperature} 
                    onChange={(e) => setTemperature(e.target.value)} 
                  />
                </div>
              </div>

              <div style={styles.row}>
                <div style={styles.col}>
                  <label style={{ fontWeight: 700, display: "block", marginBottom: "8px" }}>Longitud Máxima (Tokens: 1 a 4096)</label>
                  <input 
                    type="number" 
                    style={styles.input} 
                    value={maxLength} 
                    onChange={(e) => setMaxLength(e.target.value)} 
                  />
                </div>
                <div style={styles.col}>
                  <label style={{ fontWeight: 700, display: "block", marginBottom: "8px" }}>Endpoint del Proveedor de IA</label>
                  <input 
                    type="text" 
                    style={styles.input} 
                    value={endpoint} 
                    onChange={(e) => setEndpoint(e.target.value)} 
                  />
                </div>
              </div>
            </div>

            <div style={styles.row}>
              <div style={styles.col}>
                <div style={styles.card}>
                  <div style={styles.cardHeader}>DETALLES DE ABSTRACCIÓN</div>
                  <div style={styles.box}>
                    <strong>Modelo Activo:</strong> {model}<br/>
                    <strong>Temperatura:</strong> {temperature}<br/>
                    <strong>Longitud Máxima:</strong> {maxLength} tokens<br/>
                    <strong>Endpoint:</strong> <span style={{ fontSize: 11, wordBreak: "break-all" }}>{endpoint}</span><br/>
                    <strong>Última Sincronización:</strong> 06/05/2026 16:10:05<br/>
                    <strong>ID de Auditoría:</strong> AI55-40
                  </div>
                </div>
              </div>
              <div style={styles.col}>
                <div style={styles.card}>
                  <div style={styles.cardHeader}>LÓGICA DE NEGOCIO (Estándar)</div>
                  <div style={styles.flowchart}>
                    <div style={styles.flowItem}>[Lógica de Plantillas]</div>
                    <div style={{ fontSize: 10 }}>↓</div>
                    <div style={styles.flowItem}>[Lógica de Trayectoria]</div>
                    <div style={{ fontSize: 10 }}>↓</div>
                    <div style={styles.flowItem}>[Rango de Nota]</div>
                    <div style={{ fontSize: 10 }}>↓</div>
                    <div style={{ ...styles.flowItem, background: "#fff", borderColor: "#0770a3", fontWeight: 700 }}>[Capa de Abstracción: {model}]</div>
                  </div>
                  <p style={{ fontSize: 11, textAlign: "center", marginTop: "15px", fontStyle: "italic" }}>
                    Lógica de Negocio no modificada por el cambio de modelo. (Abstracción Activa)
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "RF56" && (
          <div>
            <div style={styles.card}>
              <div style={styles.cardHeader}>GESTIÓN DE TOKENS IA</div>
              <div style={styles.row}>
                <div style={{ flex: "0 0 400px" }}>
                  <div style={{ marginBottom: "15px" }}>
                    <label style={{ fontWeight: 700, display: "block", marginBottom: "8px" }}>Cambiar de Servicio IA</label>
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
                    <strong>Tokens Almacenados Cifrados:</strong> <span style={{ color: "#27ae60" }}>✔ Sí (OpenAI, Claude, Gemini)</span>
                  </div>
                  <div style={{ background: "#eee", padding: "10px", borderRadius: "4px" }}>
                    <strong>Estado de Token {service}:</strong> Activo, Cifrado
                  </div>
                </div>
                <div style={styles.col}>
                  <div style={{ border: "1px solid #c7cdd1", borderRadius: "4px" }}>
                    <div style={{ background: "#f0f4f7", padding: "10px", fontWeight: 700, fontSize: 11 }}>EXPOSICIÓN EN LOGS (Seguridad)</div>
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
              El cambio de token se registra con fecha, hora e ID de usuario. Se cifra en base de datos. No se expone en logs.
            </div>
          </div>
        )}

        <div style={{ marginTop: "30px", textAlign: "right", display: "flex", justifyContent: "flex-end", gap: "15px" }}>
          <button style={styles.btnSecondary} onClick={() => {
            setValidationError("");
            setSaveSuccess(false);
            setModel("GPT-4o");
            setTemperature(0.7);
            setMaxLength(2048);
            setEndpoint("https://api.openai.com/v1/chat/completions");
          }}>Descartar Cambios</button>
          <button style={styles.btnAction} onClick={handleSaveConfig}>Sincronizar y Actualizar Motor de IA Ahora</button>
        </div>
      </main>

      <StatusFooter 
        lastSync="11:45:01" 
        count={0} 
        label={`Capa de Administración Activa. Modelo: ${model}. Audit Trail Sincronizado.`} 
      />
    </div>
  );
}
