import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
const hook = fs.readFileSync(new URL('../../../client/src/views/plantillas/hooks/useTemplateEditor.js', import.meta.url), 'utf8');
const repo = fs.readFileSync(new URL('../../src/data/TemplateRepository.js', import.meta.url), 'utf8');

describe('Template preview regression after local repair', () => {
  it('does not delete entire lines mentioning course_average', () => {
    expect(hook).not.toContain(".filter(line => !line.includes('{{promedio_curso}}'))");
  });
  it('keeps a visible status for optional course-average in preview', () => {
    expect(hook).toContain('replaceAll');
    expect(hook).toContain('{{promedio_curso}}');
  });
  it('normalizes defaults before cloning for a first-time teacher', () => {
    expect(repo).toContain('normalizeSeedTemplateContent(seed.contenido)');
  });
});
