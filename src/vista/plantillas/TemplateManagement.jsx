import { useState, useEffect } from "react";
import WizardProgress from "../cursos/WizardProgress";
import StatusFooter from "../cursos/StatusFooter";
import TemplateEditor from "./TemplateEditor";
import DeleteTemplateModal from "./DeleteTemplateModal";

const styles = {
  wrapper: {
    fontFamily: "'Lato', 'Helvetica Neue', Arial, sans-serif",
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
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "15px",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 700,
  },
  btnCreate: {
    background: "#0770a3",
    color: "#fff",
    border: "none",
    padding: "10px 20px",
    borderRadius: "4px",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 14,
  },
  searchBar: {
    background: "#fff",
    border: "1px solid #c7cdd1",
    padding: "8px 12px",
    borderRadius: "4px",
    display: "flex",
    alignItems: "center",
    marginBottom: "15px",
    width: "300px",
  },
  searchInput: {
    border: "none",
    outline: "none",
    width: "100%",
    marginLeft: "8px",
    fontSize: 14,
  },
  tableWrapper: {
    background: "#fff",
    border: "1px solid #c7cdd1",
    borderRadius: "4px",
    overflow: "hidden",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    background: "#f0f4f7",
    textAlign: "left",
    padding: "12px 15px",
    fontWeight: 700,
    fontSize: 12,
    borderBottom: "2px solid #c7cdd1",
  },
  td: {
    padding: "12px 15px",
    borderBottom: "1px solid #e0e4e8",
  },
  actionIcon: {
    cursor: "pointer",
    marginRight: "10px",
    color: "#0770a3",
    fontSize: "18px",
    background: "none",
    border: "none",
    padding: 0,
  }
};

export default function TemplateManagement({ onBack, onNext }) {
  const [templates, setTemplates] = useState([]);
  const [showEditor, setShowEditor] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/templates', {
        headers: { 'Authorization': 'Bearer dev-token' }
      });
      const result = await response.json();
      if (result.exito && result.data) {
        setTemplates(result.data.map(t => ({
          id: t.id,
          name: t.nombre,
          ranges: 1, // simplified representation
          contenido: t.contenido,
          rango: t.rango
        })));
      }
    } catch (e) {
      console.error("Error fetching templates:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const filteredTemplates = templates.filter(t => 
    t.name && t.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEdit = (template) => {
    setCurrentTemplate(template);
    setShowEditor(true);
  };

  const handleDelete = (template) => {
    setCurrentTemplate(template);
    setShowDeleteModal(true);
  };

  const handleSave = async (template) => {
    try {
      const method = template.id ? 'PUT' : 'POST';
      const url = template.id ? `/api/templates/${template.id}` : '/api/templates';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer dev-token' },
        body: JSON.stringify({
          nombre: template.name,
          rango: template.rango || '>=6.0',
          contenido: template.contenido || 'Feedback content...'
        })
      });
      
      if (response.ok) {
        fetchTemplates();
        setShowEditor(false);
      }
    } catch (e) {
      console.error("Error saving template:", e);
    }
  };

  if (showEditor) {
    return (
      <TemplateEditor 
        template={currentTemplate} 
        onSave={handleSave} 
        onClose={() => setShowEditor(false)} 
      />
    );
  }

  return (
    <div style={styles.wrapper}>
      <main style={styles.main}>
        <h1 style={styles.pageTitle}>CONFIGURACIÓN - GESTIÓN DE PLANTILLAS</h1>

        <div style={styles.sectionHeader}>
          <div style={styles.sectionTitle}>BIBLIOTECA DE PLANTILLAS (Base de Datos Local)</div>
          <button style={styles.btnCreate} onClick={() => {
            setCurrentTemplate(null);
            setShowEditor(true);
          }}>+ Crear Nueva Plantilla</button>
        </div>

        <div style={styles.searchBar}>
          <span>🔍</span>
          <input 
            type="text" 
            placeholder="Buscar plantilla..." 
            style={styles.searchInput}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>NOMBRE DE PLANTILLA</th>
                <th style={{ ...styles.th, width: "100px" }}>RANGOS</th>
                <th style={{ ...styles.th, width: "150px" }}>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {filteredTemplates.map(template => (
                <tr key={template.id}>
                  <td style={styles.td}>
                    <button 
                      style={{ background: "none", border: "none", color: "#0770a3", cursor: "pointer", fontWeight: 600, padding: 0 }}
                      onClick={() => handleEdit(template)}
                    >
                      {template.name}
                    </button>
                  </td>
                  <td style={styles.td}>{template.ranges}</td>
                  <td style={styles.td}>
                    <button style={styles.actionIcon} onClick={() => handleEdit(template)} title="Editar">📝</button>
                    <button style={styles.actionIcon} onClick={() => handleDelete(template)} title="Eliminar">🗑️</button>
                    <button style={styles.actionIcon} title="Duplicar">📋</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Navigation Buttons for Wizard Integration */}
        {(onBack || onNext) && (
          <div style={{ marginTop: "30px", display: "flex", justifyContent: "space-between" }}>
            {onBack && (
              <button 
                style={{ padding: "10px 25px", background: "#fff", border: "1px solid #c7cdd1", borderRadius: "4px", cursor: "pointer" }}
                onClick={onBack}
              >
                ← Volver
              </button>
            )}
            {onNext && (
              <button 
                style={{ padding: "10px 25px", background: "#0770a3", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
                onClick={onNext}
              >
                Continuar →
              </button>
            )}
          </div>
        )}

        <WizardProgress currentStep={2} />
      </main>

      <StatusFooter lastSync="10:45:15" count={templates.length} label="Plantillas locales" isConnected={true} />

      {showDeleteModal && (
        <DeleteTemplateModal 
          template={currentTemplate} 
          onConfirm={async () => {
            try {
              await fetch(`/api/templates/${currentTemplate.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer dev-token' }
              });
              setTemplates(templates.filter(t => t.id !== currentTemplate.id));
              setShowDeleteModal(false);
            } catch (e) {
              console.error("Error deleting template:", e);
            }
          }}
          onClose={() => setShowDeleteModal(false)}
        />
      )}
    </div>
  );
}
