import { useCallback } from 'react';
import Button from '../atoms/Button';
import { useButtonLogger } from '../../hooks/useButtonLogger';
import styles from './TextToolbar.module.css';

export default function TextToolbar({ onFormat, onClear }) {
  const logFormat = useButtonLogger();
  const logClear = useButtonLogger();

  const handleFormat = useCallback(
    async (format) => {
      await logFormat(`TEMPLATE_EDITOR_FORMAT_${format.toUpperCase()}`, () => onFormat?.(format))();
    },
    [onFormat, logFormat]
  );

  const handleClear = useCallback(
    async () => {
      await logClear('TEMPLATE_EDITOR_CLEAR', () => onClear?.())();
    },
    [onClear, logClear]
  );

  return (
    <div className={styles.toolbar}>
      <Button variant="ghost" size="sm" onClick={() => handleFormat('bold')} title="Negrita"><b>B</b></Button>
      <Button variant="ghost" size="sm" onClick={() => handleFormat('italic')} title="Cursiva"><i>I</i></Button>
      <Button variant="ghost" size="sm" onClick={() => handleFormat('underline')} title="Subrayado"><u>U</u></Button>
      <div className={styles.divider} />
      <Button variant="ghost" size="sm" onClick={() => handleFormat('list')} title="Lista con viñetas">•≡</Button>
      <Button variant="ghost" size="sm" onClick={() => handleFormat('numlist')} title="Lista numerada">1≡</Button>
      <div className={styles.divider} />
      <Button variant="ghost" size="sm" onClick={handleClear} title="Limpiar todo">🗑️</Button>
    </div>
  );
}
