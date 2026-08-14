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
        * This is a preview of how the student will see the feedback in Canvas.
      </p>
    </div>
  );
}
