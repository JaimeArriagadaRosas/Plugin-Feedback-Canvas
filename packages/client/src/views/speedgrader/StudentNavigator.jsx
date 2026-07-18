import { useCallback } from 'react';
import Button from '../../components/atoms/Button';
import Select from '../../components/atoms/Select';
import { useButtonLogger } from '../../hooks/useButtonLogger';
import styles from './StudentNavigator.module.css';

export default function StudentNavigator({
  students,
  currentIndex,
  onChange,
  onExit,
  className = '',
}) {
  const logPrev = useButtonLogger();
  const logNext = useButtonLogger();
  const logChange = useButtonLogger();
  const logExit = useButtonLogger();

  const handlePrev = useCallback(
    async (e) => {
      await logPrev('SPEEDGRADER_STUDENT_PREV', () => {
        if (currentIndex > 0) {
          onChange(currentIndex - 1);
        }
      })(e);
    },
    [currentIndex, onChange, logPrev]
  );

  const handleNext = useCallback(
    async (e) => {
      await logNext('SPEEDGRADER_STUDENT_NEXT', () => {
        if (currentIndex < students.length - 1) {
          onChange(currentIndex + 1);
        }
      })(e);
    },
    [currentIndex, students.length, onChange, logNext]
  );

  const handleChange = useCallback(
    async (e) => {
      await logChange('SPEEDGRADER_STUDENT_SELECT', () => {
        onChange(parseInt(e.target.value, 10));
      })(e);
    },
    [onChange, logChange]
  );

  const handleExit = useCallback(
    async (e) => {
      await logExit('SPEEDGRADER_EXIT', () => onExit?.())(e);
    },
    [onExit, logExit]
  );

  return (
    <div className={`${styles.navigator} ${className}`}>
      <Button variant="secondary" size="sm" onClick={handlePrev} disabled={currentIndex === 0} aria-label="Estudiante anterior">
        ‹
      </Button>

      <Select
        value={currentIndex}
        onChange={handleChange}
        options={students.map((s, idx) => ({ value: String(idx), label: s.name }))}
        className={styles.select}
      />

      <Button variant="secondary" size="sm" onClick={handleNext} disabled={currentIndex === students.length - 1} aria-label="Siguiente estudiante">
        ›
      </Button>

      <span className={styles.counter}>
        {currentIndex + 1} de {students.length}
      </span>

      <Button variant="secondary" size="sm" onClick={handleExit}>
        Volver al Panel
      </Button>
    </div>
  );
}
