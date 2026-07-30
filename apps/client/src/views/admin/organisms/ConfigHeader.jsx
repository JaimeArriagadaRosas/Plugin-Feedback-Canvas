import Button from '../../../components/atoms/Button';
import styles from './ConfigHeader.module.css';

export default function ConfigHeader({ title, onExit, activeTab }) {
  return (
    <header className={styles.header}>
      <h1 className={styles.title}>
        {title}: {activeTab === "RF55" ? "CAPA DE ABSTRACCIÓN IA" : "GESTIÓN DE TOKENS IA"}
      </h1>
      {onExit && (
        <Button variant="secondary" onClick={onExit}>
          Volver al Plugin
        </Button>
      )}
    </header>
  );
}
