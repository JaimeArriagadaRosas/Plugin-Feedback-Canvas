import { useState } from "react";
import WizardProgress from "../cursos/WizardProgress";
import StatusFooter from "../cursos/StatusFooter";
import TemplateEditor from "./TemplateEditor";
import DeleteTemplateModal from "./DeleteTemplateModal";
import TemplateList from "./components/TemplateList";
import TemplateFilters from "./components/TemplateFilters";
import TemplatePagination from "./components/TemplatePagination";
import { useTemplatesManagement } from "./hooks/useTemplatesManagement";
import styles from './TemplateManagement.module.css';

export default function TemplateManagement({ onBack, onNext }) {
  const {
    filteredTemplates,
    loading,
    searchTerm,
    setSearchTerm,
    saveTemplate,
    deleteTemplate,
  } = useTemplatesManagement();

  const [showEditor, setShowEditor] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState(null);
  
  // Basic Client-side Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const totalPages = Math.ceil(filteredTemplates.length / itemsPerPage);
  
  const paginatedTemplates = filteredTemplates.slice(
    (currentPage - 1) * itemsPerPage, 
    currentPage * itemsPerPage
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
    await saveTemplate(template);
    setShowEditor(false);
  };

  const handleConfirmDelete = async () => {
    if (currentTemplate) {
      await deleteTemplate(currentTemplate.id);
      setShowDeleteModal(false);
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

        <TemplateFilters searchTerm={searchTerm} onSearchChange={setSearchTerm} />

        {loading ? (
          <div className={styles.emptyState}>Cargando plantillas...</div>
        ) : (
          <>
            <TemplateList 
              templates={paginatedTemplates} 
              onEdit={handleEdit} 
              onDelete={handleDelete} 
            />
            <TemplatePagination 
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </>
        )}

        {(onBack || onNext) && (
          <div className={styles.navButtons}>
            {onBack && <button className={styles.btnBack} onClick={onBack}>← Volver</button>}
            {onNext && <button className={styles.btnNext} onClick={onNext}>Continuar →</button>}
          </div>
        )}

        <WizardProgress currentStep={2} />
      </main>

      <StatusFooter lastSync="10:45:15" count={filteredTemplates.length} label="Plantillas locales" isConnected={true} />

      {showDeleteModal && (
        <DeleteTemplateModal 
          template={currentTemplate} 
          onConfirm={handleConfirmDelete}
          onClose={() => setShowDeleteModal(false)}
        />
      )}
    </div>
  );
}
