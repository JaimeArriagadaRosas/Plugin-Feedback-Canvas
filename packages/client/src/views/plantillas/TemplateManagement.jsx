import { useState, useEffect } from "react";
import { api } from "shared/api";
import WizardProgress from "../cursos/WizardProgress";
import StatusFooter from "../cursos/StatusFooter";
import TemplateEditor from "./TemplateEditor";
import DeleteTemplateModal from "./DeleteTemplateModal";
import { colors, font } from "shared/tokens";
import logger from "../../utils/logger";

import styles from './TemplateManagement.module.css';

export default function TemplateManagement({ onBack, onNext }) {
  const [templates, setTemplates] = useState([]);
  const [showEditor, setShowEditor] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchTemplates = async () => {
    try {
      const result = await api.get('/templates');
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
      logger.error('TemplateManagement', "Error fetching templates:", { error: e });
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
      const payload = {
        nombre: template.name,
        rango: template.rango || '>=6.0',
        contenido: template.contenido || 'Feedback content...'
      };

      if (template.id) {
        await api.put(`/templates/${template.id}`, payload);
      } else {
        await api.post('/templates', payload);
      }

      fetchTemplates();
      setShowEditor(false);
    } catch (e) {
      logger.error('TemplateManagement', "Error saving template", { error: e });
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
    <div className={styles.wrapper}>
      <main className={styles.main}>
        <h1 className={styles.pageTitle}>CONFIGURACIÓN - GESTIÓN DE PLANTILLAS</h1>

        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>BIBLIOTECA DE PLANTILLAS (Base de Datos Local)</div>
          <button className={styles.btnCreate} onClick={() => {
            setCurrentTemplate(null);
            setShowEditor(true);
          }}>+ Crear Nueva Plantilla</button>
        </div>

        <div className={styles.searchBar}>
          <span>🔍</span>
          <input 
            type="text" 
            placeholder="Buscar plantilla..." 
            className={styles.searchInput}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>NOMBRE DE PLANTILLA</th>
                <th className={styles.th} style={{ width: "100px" }}>RANGOS</th>
                <th className={styles.th} style={{ width: "150px" }}>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {filteredTemplates.map(template => (
                <tr key={template.id}>
                  <td className={styles.td}>
                    <button 
                      className={styles.templateNameBtn}
                      onClick={() => handleEdit(template)}
                    >
                      {template.name}
                    </button>
                  </td>
                  <td className={styles.td}>{template.ranges}</td>
                  <td className={styles.td}>
                    <button className={styles.actionIcon} onClick={() => handleEdit(template)} title="Editar">📝</button>
                    <button className={styles.actionIcon} onClick={() => handleDelete(template)} title="Eliminar">🗑️</button>
                    <button className={styles.actionIcon} title="Duplicar">📋</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Navigation Buttons for Wizard Integration */}
        {(onBack || onNext) && (
          <div className={styles.navButtons}>
            {onBack && (
              <button 
                className={styles.btnBack}
                onClick={onBack}
              >
                ← Volver
              </button>
            )}
            {onNext && (
              <button 
                className={styles.btnNext}
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
              await api.del(`/templates/${currentTemplate.id}`);
              setTemplates(templates.filter(t => t.id !== currentTemplate.id));
              setShowDeleteModal(false);
            } catch (e) {
              logger.error('TemplateManagement', "Error deleting template", { error: e });
            }
          }}
          onClose={() => setShowDeleteModal(false)}
        />
      )}
    </div>
  );
}
