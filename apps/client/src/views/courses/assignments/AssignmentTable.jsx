import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api';
import Button from '../../../components/atoms/Button';
import { useButtonLogger } from '../../../hooks/useButtonLogger';
import styles from './AssignmentTable.module.css';

const SKELETON_KEYS = ['skel-assign-1', 'skel-assign-2', 'skel-assign-3', 'skel-assign-4', 'skel-assign-5'];

export default function AssignmentTable({ assignments, onToggle, onTemplateChange, onError, loading }) {
  const logToggle = useButtonLogger();
  const [selectedTemplates, setSelectedTemplates] = useState({});

  const { data: templates = [] } = useQuery({
    queryKey: ['templates-raw'],
    queryFn: async () => {
      const result = await api.get('/templates');
      if (!result.exito) throw new Error(result.mensaje || 'Error fetching templates');
      return result.data || [];
    }
  });

  const handleTemplateChange = useCallback((assignmentId, value) => {
    setSelectedTemplates(prev => ({ ...prev, [assignmentId]: value }));
    onTemplateChange?.(assignmentId, value);
  }, [onTemplateChange]);

  const handleToggle = useCallback(
    (assignment) => {
      const plantilla_id = selectedTemplates[assignment.id] !== undefined 
        ? selectedTemplates[assignment.id] 
        : (assignment.active ? (assignment.plantilla_id || assignment.template) : "");
      logToggle(`ASSIGNMENT_TOGGLE_${assignment.active ? 'DEACTIVATE' : 'ACTIVATE'}`, () => onToggle?.({ ...assignment, plantilla_id }))();
    },
    [onToggle, logToggle, selectedTemplates]
  );

  if (!loading && assignments.length === 0) {
    return (
      <div className={styles.empty}>
        No assignments found for this course yet.
      </div>
    );
  }

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th style={{ width: '35%' }}>Assignment Name</th>
          <th style={{ width: '15%' }}>Due Date</th>
          <th style={{ width: '15%', textAlign: 'center' }}>Rubric Detected</th>
          <th style={{ width: '25%' }}>Assigned Template</th>
          <th style={{ width: '15%' }}>Plugin Active</th>
        </tr>
      </thead>
      <tbody>
        {loading ? (
          SKELETON_KEYS.map((key) => (
            <tr key={key}>
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
                value={selectedTemplates[item.id] !== undefined 
                  ? selectedTemplates[item.id] 
                  : (item.active ? (item.plantilla_id || item.template || '') : '')}
                onChange={(e) => handleTemplateChange(item.id, e.target.value)}
              >
                <option value="">Select template...</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.nombre || t.name}</option>
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
                  {item.active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </td>
          </tr>
        )))}
      </tbody>
    </table>
  );
}
