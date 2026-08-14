import { useState, useEffect } from "react";
import WizardProgress from "../courses/WizardProgress";
import TemplateEditor from "./TemplateEditor";
import DeleteTemplateModal from "./DeleteTemplateModal";
import TemplateList from "./components/TemplateList";
import TemplateFilters from "./components/TemplateFilters";
import TemplatePagination from "./components/TemplatePagination";
import ConfirmDialog from "../../components/molecules/ConfirmDialog";
import { useTemplatesManagement } from "./hooks/useTemplatesManagement";
import { useAssignmentList } from '../courses/hooks/useAssignmentList';
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
      setErrorMsg("Please create at least one template to continue.");
      return;
    }
    const activeAssignments = assignments.filter(a => Boolean(a.active) === true);
    if (activeAssignments.length === 0) {
      setErrorMsg("You must enable the plugin for at least one assignment to continue.");
      return;
    }
    const orphaned = activeAssignments.filter(a => !a.plantilla_id && !a.template);
    if (orphaned.length > 0) {
      setErrorMsg(`There are ${orphaned.length} active assignment(s) without a configured template in Step 1. Please go back to Step 1 and select a template.`);
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
        <h1 className={styles.pageTitle}>CONFIGURATION — TEMPLATE MANAGEMENT</h1>

        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>TEMPLATE LIBRARY (Local Database)</div>
          <button className={styles.btnCreate} onClick={() => {
            setCurrentTemplate(null);
            setShowEditor(true);
          }}>+ Create New Template</button>
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

      {/* Bottom sticky bar */}
      <div className={styles.stickyBar}>
        {(onBack || onNext) && (
          <div className={styles.navButtons}>
            {onBack && <button className={styles.btnBack} onClick={onBack}>Back</button>}
            {onNext && <button className={styles.btnNext} onClick={handleNext}>Continue</button>}
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
          title="Confirm Duplication"
          message={`Are you sure you want to create a copy of the template "${templateToDuplicate?.name}"?`}
          confirmLabel="Yes, duplicate"
          cancelLabel="Cancel"
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
