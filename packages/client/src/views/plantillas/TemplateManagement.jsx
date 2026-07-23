import { useState, useEffect } from "react";
import WizardProgress from "../cursos/WizardProgress";
import TemplateEditor from "./TemplateEditor";
import DeleteTemplateModal from "./DeleteTemplateModal";
import TemplateList from "./components/TemplateList";
import TemplateFilters from "./components/TemplateFilters";
import TemplatePagination from "./components/TemplatePagination";
import ConfirmDialog from "../../components/molecules/ConfirmDialog";
import { useTemplatesManagement } from "./hooks/useTemplatesManagement";
import { useAssignmentList } from "../cursos/hooks/useAssignmentList";
import styles from './TemplateManagement.module.css';

export default function TemplateManagement({ courseId, onBack, onNext }) {
  const {
    templates,
    filteredTemplates,
    loading,
    searchTerm,
    setSearchTerm,
    saveTemplate,
    deleteTemplate,
  } = useTemplatesManagement();

  const { assignments } = useAssignmentList({ id: courseId });

  const [showEditor, setShowEditor] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState(null);
  const [templateToDuplicate, setTemplateToDuplicate] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    if (errorMsg) {
      const timer = setTimeout(() => setErrorMsg(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [errorMsg]);
  
  const handleNext = () => {
    if (templates.length === 0) {
      setErrorMsg("Por favor, cree al menos una plantilla para continuar.");
      return;
    }
    const hasActiveAssignments = assignments.some(a => Boolean(a.active) === true);
    if (!hasActiveAssignments) {
      setErrorMsg("Debe activar el plugin al menos en una tarea para continuar.");
      return;
    }
    if (onNext) onNext();
  };
  
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

  const handleRequestDuplicate = (template) => {
    setTemplateToDuplicate(template);
    setShowDuplicateModal(true);
  };

  const handleConfirmDuplicate = () => {
    if (templateToDuplicate) {
      const duplicated = {
        ...templateToDuplicate,
        id: undefined,
        name: `Copia de ${templateToDuplicate.name}`,
        ranges: templateToDuplicate.ranges,
        contenido: templateToDuplicate.contenido,
      };
      setCurrentTemplate(duplicated);
      setShowEditor(true);
    }
    setShowDuplicateModal(false);
    setTemplateToDuplicate(null);
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

        <TemplateList 
          templates={paginatedTemplates} 
          loading={loading}
          onEdit={handleEdit} 
          onDelete={handleDelete}
          onRequestDuplicate={handleRequestDuplicate}
        />
        {!loading && (
          <TemplatePagination 
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        )}

      </main>

      {/* Barra sticky inferior */}
      <div className={styles.stickyBar}>
        {(onBack || onNext) && (
          <div className={styles.navButtons}>
            {onBack && <button className={styles.btnBack} onClick={onBack}>Volver</button>}
            {onNext && <button className={styles.btnNext} onClick={handleNext}>Continuar</button>}
          </div>
        )}
        <WizardProgress currentStep={2} />
      </div>

      {showDeleteModal && (
        <DeleteTemplateModal 
          template={currentTemplate} 
          onConfirm={handleConfirmDelete}
          onClose={() => setShowDeleteModal(false)}
        />
      )}

      {showDuplicateModal && (
        <ConfirmDialog
          isOpen={showDuplicateModal}
          onClose={() => setShowDuplicateModal(false)}
          onConfirm={handleConfirmDuplicate}
          title="Confirmar Duplicación"
          message={`¿Está seguro de que desea crear una copia de la plantilla "${templateToDuplicate?.name}"?`}
          confirmLabel="Sí, duplicar"
          cancelLabel="Cancelar"
          confirmVariant="primary"
        />
      )}

      {errorMsg && (
        <div style={{ backgroundColor: '#e74c3c', color: 'white', cursor: 'pointer', position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)', padding: '12px 24px', borderRadius: '4px', zIndex: 1000, display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} onClick={() => setErrorMsg(null)}>
          <span style={{ fontSize: 18 }}>&#x26A0;</span>
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
}
