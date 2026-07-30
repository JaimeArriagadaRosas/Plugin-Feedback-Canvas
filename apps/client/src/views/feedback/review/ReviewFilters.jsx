import { useCallback } from 'react';
import FilterBar from '../../../components/molecules/FilterBar';
import { useButtonLogger } from '../../../hooks/useButtonLogger';
import styles from './ReviewFilters.module.css';

export default function ReviewFilters({
  selectedCourse,
  setSelectedCourse,
  selectedAssignment,
  setSelectedAssignment,
  coursesList = [{ value: 'Todos', label: 'Todos los Cursos' }],
  assignmentsList = [{ value: 'Todas', label: 'Todas las Asignaciones' }],
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
            options: coursesList,
            placeholder: 'Seleccione un curso...',
          },
          {
            key: 'assignment',
            id: 'filter-assignment',
            label: 'Filtrar por Asignación',
            value: selectedAssignment,
            onChange: setSelectedAssignment,
            options: assignmentsList,
            placeholder: 'Seleccione una asignación...',
          },
        ]}
        onClear={handleClear}
      />
    </div>
  );
}
