import React, { useMemo } from 'react';
import styles from './LivePreview.module.css';
import { RichTextProcessor } from '../../../utils/RichTextProcessor';

export default function LivePreview({ text }) {
  const processedText = useMemo(() => {
    return RichTextProcessor.process(text);
  }, [text]);

  return (
    <div className={styles.container}>
      <div 
        className={styles.preview} 
        style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}
      >
        {processedText}
      </div>
      <p className={styles.hint}>
        * Esta es una vista previa de cómo el estudiante verá el feedback en Canvas.
      </p>
    </div>
  );
}
