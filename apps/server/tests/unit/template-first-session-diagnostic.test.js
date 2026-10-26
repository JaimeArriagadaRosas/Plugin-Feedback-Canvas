import { describe, it, expect, vi } from 'vitest';
import TemplateManager from '../../src/services/TemplateManager.js';

describe('first-login template lifecycle diagnostics', () => {
  it('clones seeded templates for a new teacher, then marks seeding complete', async () => {
    const templates = [{ id: 1, profesor_id: 'teacher-test', contenido: '{"alto":"hello","medio":"hi","bajo":"bye"}' }];
    const repo = {
      listByProfesor: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce(templates),
      hasSeededTemplates: vi.fn().mockResolvedValue(false),
      cloneDefaultTemplates: vi.fn().mockResolvedValue(undefined),
      markTemplatesAsSeeded: vi.fn().mockResolvedValue(undefined)
    };
    expect(await new TemplateManager(repo).getTemplatesForProfesor('teacher-test')).toEqual(templates);
    expect(repo.cloneDefaultTemplates).toHaveBeenCalledOnce();
    expect(repo.markTemplatesAsSeeded).toHaveBeenCalledOnce();
  });
  it('does not re-seed a teacher already marked seeded', async () => {
    const repo = {
      listByProfesor: vi.fn().mockResolvedValue([{ profesor_id: 'teacher-test' }]),
      hasSeededTemplates: vi.fn().mockResolvedValue(true),
      cloneDefaultTemplates: vi.fn(), markTemplatesAsSeeded: vi.fn()
    };
    await new TemplateManager(repo).getTemplatesForProfesor('teacher-test');
    expect(repo.cloneDefaultTemplates).not.toHaveBeenCalled();
  });
});
