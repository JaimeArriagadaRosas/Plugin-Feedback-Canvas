import Button from '../../../components/atoms/Button';
import styles from './ConfigHeader.module.css';

export default function ConfigHeader({ title, onExit, activeTab }) {
  return (
    <header className={styles.header}>
      <h1 className={styles.title}>
        {title}: {activeTab === "RF55" ? "AI ABSTRACTION LAYER" : "AI TOKEN MANAGEMENT"}
      </h1>
      {onExit && (
        <Button variant="secondary" onClick={onExit}>
          Back to Plugin
        </Button>
      )}
    </header>
  );
}
