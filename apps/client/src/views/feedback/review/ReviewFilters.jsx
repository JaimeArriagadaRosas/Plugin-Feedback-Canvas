import { useCallback } from 'react';
import FilterBar from '../../../components/molecules/FilterBar';
import { useButtonLogger } from '../../../hooks/useButtonLogger';
import styles from './ReviewFilters.module.css';

export default function ReviewFilters({
  selectedCourse,
  setSelectedCourse,
  selectedAssignment,
  setSelectedAssignment,
  coursesList = [{ value: 'Todos', label: 'All Courses' }],
  assignmentsList = [{ value: 'Todas', label: 'All Assignments' }],
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
            label: 'Filter by Course',
            value: selectedCourse,
            onChange: setSelectedCourse,
            options: coursesList,
            placeholder: 'Select a course...',
          },
          {
            key: 'assignment',
            id: 'filter-assignment',
            label: 'Filter by Assignment',
            value: selectedAssignment,
            onChange: setSelectedAssignment,
            options: assignmentsList,
            placeholder: 'Select an assignment...',
          },
        ]}
        onClear={handleClear}
      />
    </div>
  );
}
