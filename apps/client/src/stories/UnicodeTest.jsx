import React, { useState } from 'react';
import PropTypes from 'prop-types';
import './unicode.css';

/**
 * UnicodeTest demuestra cómo manejar correctamente caracteres Unicode complejos
 * como emojis compuestos, "surrogate pairs" y texto internacional usando Intl.Segmenter.
 */
export const UnicodeTest = ({ text, maxLength }) => {
  const [useSegmenter, setUseSegmenter] = useState(true);

  // Truncado clásico (inseguro con Emojis, puede partirlos por la mitad)
  const classicTruncate = (str, length) => {
    if (!str || str.length <= length) return str;
    return str.slice(0, length) + '...';
  };

  // Truncado moderno y seguro con Intl.Segmenter
  const safeTruncate = (str, length) => {
    if (!str) return str;
    const segmenter = new Intl.Segmenter('es', { granularity: 'grapheme' });
    const segments = Array.from(segmenter.segment(str));
    if (segments.length <= length) return str;
    return segments.slice(0, length).map(s => s.segment).join('') + '...';
  };

  const truncated = useSegmenter ? safeTruncate(text, maxLength) : classicTruncate(text, maxLength);

  return (
    <div className="unicode-test">
      <h3>Prueba de Estrés Unicode / Emoji</h3>
      <div className="controls">
        <label>
          <input 
            type="checkbox" 
            checked={useSegmenter} 
            onChange={(e) => setUseSegmenter(e.target.checked)} 
          />
          Usar Intl.Segmenter (Truncado Seguro)
        </label>
      </div>
      
      <div className="result-card">
        <p><strong>Texto Original:</strong></p>
        <div className="text-box original">{text}</div>
        
        <p><strong>Texto Truncado (Max {maxLength} grafemas/caracteres):</strong></p>
        <div className="text-box truncated">{truncated}</div>
      </div>
    </div>
  );
};

UnicodeTest.propTypes = {
  text: PropTypes.string.isRequired,
  maxLength: PropTypes.number,
};

UnicodeTest.defaultProps = {
  maxLength: 5,
};
