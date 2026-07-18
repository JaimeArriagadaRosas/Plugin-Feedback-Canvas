import { useCallback } from 'react';
import FilterBar from '../../../components/molecules/FilterBar';
import { useButtonLogger } from '../../../hooks/useButtonLogger';
import styles from './ReviewFilters.module.css';

export default function ReviewFilters({
  selectedCourse,
  setSelectedCourse,
  selectedAssignment,
  setSelectedAssignment,
  onClear,
}) {
  const logClear = useButtonLogger();

  const handleClear = useCallback(
    async () => {
      await logClear('FEEDBACK_REVIEW_CLEAR_FILTERS', () => onClear?.())();
    },
    [onClear, logClear]
  );

  return (
    <div className={styles.filters}>
      <FilterBar
        filters={[
          {
            key: 'course',
            id: 'filter-course',
            label: 'Filtrar por Curso',
            value: selectedCourse,
            onChange: setSelectedCourse,
            options: [{ value: 'Todos', label: 'Todos los Cursos' }],
            placeholder: 'Todos los Cursos',
          },
          {
            key: 'assignment',
            id: 'filter-assignment',
            label: 'Filtrar por Asignación',
            value: selectedAssignment,
            onChange: setSelectedAssignment,
            options: [{ value: 'Todas', label: 'Todas las Asignaciones' }],
            placeholder: 'Todas las Asignaciones',
          },
        ]}
        onClear={handleClear}
      />
    </div>
  );
}
