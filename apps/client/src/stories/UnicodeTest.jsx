import React, { useState } from 'react';
import PropTypes from 'prop-types';
import './unicode.css';

/**
 * UnicodeTest demonstrates how to correctly handle complex Unicode characters
 * like compound emojis, "surrogate pairs" and international text using Intl.Segmenter.
 */
export const UnicodeTest = ({ text, maxLength }) => {
  const [useSegmenter, setUseSegmenter] = useState(true);

  // Classic truncate (unsafe with Emojis, may split them in half)
  const classicTruncate = (str, length) => {
    if (!str || str.length <= length) return str;
    return str.slice(0, length) + '...';
  };

  // Modern and safe truncate with Intl.Segmenter
  const safeTruncate = (str, length) => {
    if (!str) return str;
    const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
    const segments = Array.from(segmenter.segment(str));
    if (segments.length <= length) return str;
    return segments.slice(0, length).map(s => s.segment).join('') + '...';
  };

  const truncated = useSegmenter ? safeTruncate(text, maxLength) : classicTruncate(text, maxLength);

  return (
    <div className="unicode-test">
      <h3>Unicode / Emoji Stress Test</h3>
      <div className="controls">
        <label>
          <input 
            type="checkbox" 
            checked={useSegmenter} 
            onChange={(e) => setUseSegmenter(e.target.checked)} 
          />
          Use Intl.Segmenter (Safe Truncate)
        </label>
      </div>
      
      <div className="result-card">
        <p><strong>Original Text:</strong></p>
        <div className="text-box original">{text}</div>
        
        <p><strong>Truncated Text (Max {maxLength} graphemes/characters):</strong></p>
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
