import { useCallback } from 'react';
import Select from '../../components/atoms/Select';
import { useButtonLogger } from '../../hooks/useButtonLogger';
import styles from './AssignmentSelector.module.css';

export default function AssignmentSelector({
  assignments,
  currentAssignmentId,
  onChange,
  className = '',
}) {
  const logChange = useButtonLogger();

  const handleChange = useCallback(
    async (e) => {
      const newAssignId = parseInt(e.target.value, 10);
      await logChange('SPEEDGRADER_ASSIGNMENT_CHANGE', () => onChange(newAssignId))(e);
    },
    [onChange, logChange]
  );

  return (
    <div className={`${styles.wrapper} ${className}`}>
      <label className={styles.label}>Tarea</label>
      <Select
        value={currentAssignmentId}
        onChange={handleChange}
        options={assignments.map(a => ({ value: String(a.id), label: a.name }))}
        className={styles.select}
      />
    </div>
  );
}
