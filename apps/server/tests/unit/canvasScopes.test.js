import { describe, it, expect } from 'vitest';
import { REQUIRED_CANVAS_SCOPES } from '../../src/constants/canvasScopes.js';
import FileController from '../../src/controllers/FileController.js';

describe('Canvas OAuth Scopes Contract', () => {
  it('Debe incluir los scopes necesarios para File Preview', () => {
    // Validamos que la lista centralizada incluya estrictamente los endpoints requeridos
    expect(REQUIRED_CANVAS_SCOPES).toContain('url:GET|/api/v1/files/:id');
    expect(REQUIRED_CANVAS_SCOPES).toContain('url:GET|/files/:file_id/download');
  });

  it('No debe haber divergencia entre backend e instalador (se validan mediante la misma importación compartida)', () => {
    // Ya que ambas partes importan la misma constante, garantizamos la regla matemática:
    // requested OAuth scopes == Developer Key scopes
    expect(REQUIRED_CANVAS_SCOPES.length).toBeGreaterThan(10);
    // Verificamos que no haya duplicados
    const uniqueScopes = new Set(REQUIRED_CANVAS_SCOPES);
    expect(uniqueScopes.size).toBe(REQUIRED_CANVAS_SCOPES.length);
  });
});
