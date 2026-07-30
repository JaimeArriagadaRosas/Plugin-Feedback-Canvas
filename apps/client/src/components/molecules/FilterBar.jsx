import Button from '../atoms/Button';
import Select from '../atoms/Select';
import styles from './FilterBar.module.css';

export default function FilterBar({
  filters = [],
  onClear,
  className = '',
  ...props
}) {
  return (
    <div className={`${styles.bar} ${className}`} {...props}>
      {filters.map((filter) => (
        <div key={filter.key} className={styles.group}>
          <label className={styles.label} htmlFor={filter.id}>
            {filter.label}
          </label>
          <Select
            id={filter.id}
            value={filter.value}
            onChange={(e) => filter.onChange(e.target.value)}
            options={filter.options}
            placeholder={filter.placeholder}
          />
        </div>
      ))}
      {onClear && (
        <Button variant="secondary" size="sm" onClick={onClear} className={styles.clear}>
          Limpiar Filtros
        </Button>
      )}
    </div>
  );
}
