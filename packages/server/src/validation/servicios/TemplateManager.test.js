import { describe, it, expect, vi } from 'vitest';
import TemplateManager from '../../services/TemplateManager.js';

describe('TemplateManager  Caja Negra', () => {
  it('getTemplateForScore retorna plantilla con tono aprobatorio', async () => {
    const mockRepo = {
      getById: vi.fn(async (id) => ({
        id,
        nombre: `Plantilla ${id}`,
        contenido: 'Contenido base'
      }))
    };
    const manager = new TemplateManager(mockRepo);
    const result = await manager.getTemplateForScore(1, 90, 100);

    expect(result).toBeDefined();
    expect(result.id).toBe(1);
    expect(result.instructionIA).toContain('aprobado');
    expect(result.instructionIA).toContain('motivador');
  });

  it('getTemplateForScore retorna plantilla con tono de apoyo para nota baja', async () => {
    const mockRepo = {
      getById: vi.fn(async (id) => ({
        id,
        nombre: `Plantilla ${id}`,
        contenido: 'Contenido base'
      }))
    };
    const manager = new TemplateManager(mockRepo);
    const result = await manager.getTemplateForScore(1, 40, 100);

    expect(result).toBeDefined();
    expect(result.instructionIA).toContain('apoyo');
    expect(result.instructionIA).toContain('refuerzo');
  });

  it('getTemplateForScore maneja plantilla inexistente retornando null', async () => {
    const mockRepo = {
      getById: vi.fn(async () => null)
    };
    const manager = new TemplateManager(mockRepo);
    const result = await manager.getTemplateForScore(999, 90, 100);

    expect(result).toBeNull();
  });

  it('createTemplate delega al repositorio', async () => {
    const saveMock = vi.fn(async (data) => ({ id: 1, ...data }));
    const manager = new TemplateManager({ save: saveMock });

    const result = await manager.createTemplate({ nombre: 'Nueva', contenido: 'Contenido' });
    expect(result).toBeDefined();
    expect(result.nombre).toBe('Nueva');
  });
});
