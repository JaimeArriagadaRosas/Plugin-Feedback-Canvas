import { useCallback } from 'react';
import Input from '../../components/atoms/Input';
import { useButtonLogger } from '../../hooks/useButtonLogger';
import styles from './GradeInput.module.css';

export default function GradeInput({ grade, maxPoints, onChange, className = '' }) {
  const logChange = useButtonLogger();

  const handleChange = useCallback(
    async (e) => {
      await logChange('SPEEDGRADER_GRADE_CHANGE', () => onChange(parseFloat(e.target.value)))(e);
    },
    [onChange, logChange]
  );

  return (
    <div className={`${styles.wrapper} ${className}`}>
      <label className={styles.label}>Grade</label>
      <div className={styles.row}>
        <Input
          type="number"
          value={grade}
          onChange={handleChange}
          className={styles.input}
          inputProps={{ step: '0.1' }}
        />
        <span className={styles.max}>/ {maxPoints}</span>
      </div>
      <span className={styles.hint}>Synchronized with Canvas</span>
    </div>
  );
}
