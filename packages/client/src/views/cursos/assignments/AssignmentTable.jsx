import { useCallback } from 'react';
import Button from '../../../components/atoms/Button';
import { useButtonLogger } from '../../../hooks/useButtonLogger';
import styles from './AssignmentTable.module.css';

export default function AssignmentTable({ assignments, onToggle }) {
  const logToggle = useButtonLogger();

  const handleToggle = useCallback(
    (assignment) => {
      logToggle(`ASSIGNMENT_TOGGLE_${assignment.active ? 'DEACTIVATE' : 'ACTIVATE'}`, () => onToggle?.(assignment))();
    },
    [onToggle, logToggle]
  );

  if (assignments.length === 0) {
    return (
      <div className={styles.empty}>
        No se encontraron asignaciones para este curso.
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
        {assignments.map((item) => (
          <tr key={item.id}>
            <td>
              <a href="#" className={styles.link}>{item.name}</a>
            </td>
            <td>{item.due}</td>
            <td style={{ textAlign: 'center' }}>
              <span className={styles.icon}>✔</span>
            </td>
            <td>
              <select className={styles.select} defaultValue={item.template}>
                <option value="">Seleccionar plantilla...</option>
                <option value="Clase Standard">Clase Estándar</option>
                <option value="Feedback Detallado">Feedback Detallado</option>
                <option value="Evaluación Cruzada">Evaluación Cruzada</option>
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
        ))}
      </tbody>
    </table>
  );
}
