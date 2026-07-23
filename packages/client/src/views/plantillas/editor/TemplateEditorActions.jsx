import Button from '../../../components/atoms/Button';

export default function TemplateEditorActions({ template, handleDelete, handleClose, handleSave }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', background: '#f8f9fa', borderTop: '1px solid #e2e8f0', marginTop: 'auto' }}>
      <Button variant="danger" onClick={handleDelete}>
        Eliminar esta Plantilla
      </Button>
      <div style={{ display: 'flex', gap: '12px' }}>
        <Button variant="secondary" onClick={handleClose}>
          Cancelar Cambios
        </Button>
        <Button variant="primary" onClick={handleSave}>
          {template ? "Actualizar Plantilla" : "Guardar Nueva Plantilla"}
        </Button>
      </div>
    </div>
  );
}
