import { describe, it, expect } from 'vitest';
import { RichTextProcessor } from './RichTextProcessor.js';

describe('RichTextProcessor', () => {
  it('should process bold text to unicode', () => {
    const input = 'Hola **mundo**';
    const output = RichTextProcessor.process(input);
    // 'm' in Mathematical Sans-Serif Bold is 𝗺
    // 'u' is 𝘂
    // 'n' is 𝗻
    // 'd' is 𝗱
    // 'o' is 𝗼
    expect(output).toBe('Hola 𝗺𝘂𝗻𝗱𝗼');
  });

  it('should process italic text to unicode', () => {
    const input1 = 'Hola *mundo*';
    const output1 = RichTextProcessor.process(input1);
    expect(output1).toBe('Hola 𝘮𝘶𝘯𝘥𝘰');

    const input2 = 'Hola _mundo_';
    const output2 = RichTextProcessor.process(input2);
    expect(output2).toBe('Hola 𝘮𝘶𝘯𝘥𝘰');
  });

  it('should process lists to use bullet points', () => {
    const input = '- Item 1\n* Item 2';
    const output = RichTextProcessor.process(input);
    expect(output).toBe('• Item 1\n• Item 2');
  });

  it('should process underline text to unicode', () => {
    const input = '<u>Hola</u>';
    const output = RichTextProcessor.process(input);
    expect(output).toBe('H\u0332o\u0332l\u0332a\u0332');
  });

  it('should process combined markdown', () => {
    const input = '**Negrita**, *cursiva* y:\n- Lista';
    const output = RichTextProcessor.process(input);
    expect(output).toBe('𝗡𝗲𝗴𝗿𝗶𝘁𝗮, 𝘤𝘶𝘳𝘴𝘪𝘷𝘢 y:\n• Lista');
  });

  it('should not throw on empty text', () => {
    expect(RichTextProcessor.process(null)).toBe(null);
    expect(RichTextProcessor.process('')).toBe('');
  });
});
