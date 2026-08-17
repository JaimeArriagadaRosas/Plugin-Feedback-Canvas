import { useCallback } from 'react';
import { useButtonLogger } from '../../../hooks/useButtonLogger';
import styles from './VariableInserter.module.css';

const VARIABLES = [
  { key: 'student_name', label: '{{student_name}}' },
  { key: 'grade', label: '{{grade}}' },
  { key: 'course_average', label: '{{course_average}}' },
];

export default function VariableInserter({ onInsert }) {
  const logInsert = useButtonLogger();

  const handleInsert = useCallback(
    async (key) => {
      await logInsert(`TEMPLATE_EDITOR_INSERT_${key.toUpperCase()}`, () => onInsert?.(key))();
    },
    [onInsert, logInsert]
  );

  return (
    <div className={styles.container}>
      {VARIABLES.map((v) => (
        <button
          key={v.key}
          type="button"
          className={styles.chip}
          onClick={() => handleInsert(v.key)}
        >
          {v.label} ➕
        </button>
      ))}
    </div>
  );
}
