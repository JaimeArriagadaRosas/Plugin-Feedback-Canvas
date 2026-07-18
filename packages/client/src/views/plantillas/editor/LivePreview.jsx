import styles from './LivePreview.module.css';

export default function LivePreview({ text }) {
  return (
    <div className={styles.container}>
      <div className={styles.preview}>{text}</div>
      <p className={styles.hint}>
        * Esta es una vista previa de cómo el estudiante verá el feedback en Canvas.
      </p>
    </div>
  );
}
