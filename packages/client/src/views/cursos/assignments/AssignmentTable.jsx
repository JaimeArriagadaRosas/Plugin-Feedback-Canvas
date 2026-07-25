import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from 'shared/api';
import Button from '../../../components/atoms/Button';
import { useButtonLogger } from '../../../hooks/useButtonLogger';
import styles from './AssignmentTable.module.css';

export default function AssignmentTable({ assignments, onToggle, onTemplateChange, onError, loading }) {
  const logToggle = useButtonLogger();
  const [selectedTemplates, setSelectedTemplates] = useState({});

  const { data: templates = [] } = useQuery({
    queryKey: ['templates-raw'],
    queryFn: async () => {
      const result = await api.get('/templates');
      if (!result.exito) throw new Error(result.mensaje || 'Error al obtener plantillas');
      return result.data || [];
    }
  });

  const handleTemplateChange = useCallback((assignmentId, value) => {
    setSelectedTemplates(prev => ({ ...prev, [assignmentId]: value }));
    onTemplateChange?.(assignmentId, value);
  }, [onTemplateChange]);

  const handleToggle = useCallback(
    (assignment) => {
      const plantilla_id = selectedTemplates[assignment.id] !== undefined ? selectedTemplates[assignment.id] : (assignment.plantilla_id || assignment.template);
      if (!assignment.active && (!plantilla_id || plantilla_id === "")) {
        if (onError) {
          onError("Debe seleccionar una plantilla para esta tarea antes de activar el plugin IA.");
        } else {
          alert("Debe seleccionar una plantilla para esta tarea antes de activar el plugin IA.");
        }
        return;
      }
      logToggle(`ASSIGNMENT_TOGGLE_${assignment.active ? 'DEACTIVATE' : 'ACTIVATE'}`, () => onToggle?.({ ...assignment, plantilla_id }))();
    },
    [onToggle, logToggle, selectedTemplates, onError]
  );

  if (!loading && assignments.length === 0) {
    return (
      <div className={styles.empty}>
        Aún no hay tareas para este curso.
      </div>
    );
  }

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th style={{ width: '35%' }}>Nombre de la Tarea</th>
          <th style={{ width: '15%' }}>Fecha de Entrega</th>
          <th style={{ width: '15%', textAlign: 'center' }}>Rúbrica Detectada</th>
          <th style={{ width: '25%' }}>Plantilla Asignada</th>
          <th style={{ width: '15%' }}>Plugin Activo</th>
        </tr>
      </thead>
      <tbody>
        {loading ? (
          Array.from({ length: 5 }).map((_, idx) => (
            <tr key={`skel-${idx}`}>
              <td><div className={`${styles.skeletonCell} ${styles.skeletonCellLong}`} /></td>
              <td><div className={`${styles.skeletonCell} ${styles.skeletonCellMedium}`} /></td>
              <td><div className={`${styles.skeletonCell} ${styles.skeletonCellShort}`} style={{ margin: 'auto' }} /></td>
              <td><div className={`${styles.skeletonCell} ${styles.skeletonCellLong}`} /></td>
              <td><div className={`${styles.skeletonCell} ${styles.skeletonCellMedium}`} /></td>
            </tr>
          ))
        ) : (
          assignments.map((item) => (
            <tr key={item.id}>
            <td>
              <a href="#" className={styles.link}>{item.name}</a>
            </td>
            <td>{item.due}</td>
            <td style={{ textAlign: 'center' }}>
              {item.rubric ? (
                <span className={styles.icon} style={{ color: 'green' }}>✔</span>
              ) : (
                <span className={styles.icon} style={{ color: 'red' }}>❌</span>
              )}
            </td>
            <td>
              <select 
                className={styles.select} 
                value={selectedTemplates[item.id] !== undefined ? selectedTemplates[item.id] : (item.plantilla_id || item.template || '')}
                onChange={(e) => handleTemplateChange(item.id, e.target.value)}
              >
                <option value="">Seleccionar plantilla...</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.nombre}</option>
                ))}
              </select>
            </td>
            <td>
              <div
                className={`${styles.toggle} ${item.active ? styles.toggleOn : ''}`}
                onClick={() => handleToggle(item)}
                role="switch"
                aria-checked={item.active}
                tabIndex={0}
              >
                <div className={`${styles.handle} ${item.active ? styles.handleOn : ''}`} />
                <span className={styles.label}>
                  {item.active ? 'Activo' : 'Inactivo'}
                </span>
              </div>
            </td>
          </tr>
        )))}
      </tbody>
    </table>
  );
}
