import styles from '../TemplateManagement.module.css';

export default function TemplateFilters({ searchTerm, onSearchChange }) {
  return (
    <div className={styles.searchBar}>
      <span>🔍</span>
      <input 
        type="text" 
        placeholder="Search template..." 
        className={styles.searchInput}
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
      />
    </div>
  );
}
