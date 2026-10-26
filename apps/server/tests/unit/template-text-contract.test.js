import { describe, it, expect } from 'vitest';
import { normalizeSeedTemplateContent } from '../../src/services/templates/normalizeSeedTemplateContent.js';
import { omitMissingVariableParagraphs } from '../../src/services/variables/OptionalTemplateVariable.js';

describe('Template text contract (both languages)', () => {
  it('converts visible backslash-n into real Enter line breaks', () => {
    const input = JSON.stringify({ alto: 'Hello\\n\\nWorld', medio: 'A', bajo: 'B' });
    const result = JSON.parse(normalizeSeedTemplateContent(input));
    expect(result.alto).toBe('Hello\n\nWorld');
    expect(result.alto).not.toContain('\\n');
  });
  it('preserves a real Enter after JSON round-trip', () => {
    const input = JSON.stringify({ alto: 'Hello\nWorld', medio: 'A', bajo: 'B' });
    expect(JSON.parse(normalizeSeedTemplateContent(input)).alto).toBe('Hello\nWorld');
  });
  it('does not delete teacher content next to an unavailable variable', () => {
    expect(omitMissingVariableParagraphs('{{course_average}} Keep studying', '{{course_average}}'))
      .toBe('Keep studying');
  });
  it('omits an isolated unavailable variable, preserving adjacent paragraphs', () => {
    expect(omitMissingVariableParagraphs('Before\n{{course_average}}\nAfter', '{{course_average}}'))
      .toBe('Before\nAfter');
  });
});
