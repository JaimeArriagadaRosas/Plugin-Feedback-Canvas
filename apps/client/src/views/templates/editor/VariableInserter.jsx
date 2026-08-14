import { useCallback } from 'react';
import { useButtonLogger } from '../../../hooks/useButtonLogger';
import styles from './VariableInserter.module.css';

const VARIABLES = [
  { key: 'nombre_estudiante', label: '{{nombre_estudiante}}' },
  { key: 'calificacion', label: '{{calificacion}}' },
  { key: 'promedio_curso', label: '{{promedio_curso}}' },
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
