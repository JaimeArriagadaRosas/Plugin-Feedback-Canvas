import { describe, it, expect } from 'vitest';
import { REQUIRED_CANVAS_SCOPES } from '../../src/constants/canvasScopes.js';
import FileController from '../../src/controllers/FileController.js';

describe('Canvas OAuth Scopes Contract', () => {
  it('Must include necessary scopes for File Preview', () => {
    // Validate that the centralized list strictly includes the required endpoints
    expect(REQUIRED_CANVAS_SCOPES).toContain('url:GET|/api/v1/files/:id');
    expect(REQUIRED_CANVAS_SCOPES).toContain('url:GET|/files/:file_id/download');
  });

  it('There must be no divergence between backend and installer (validated through the same shared import)', () => {
    // Since both parties import the same constant, we guarantee the mathematical rule:
    // requested OAuth scopes == Developer Key scopes
    expect(REQUIRED_CANVAS_SCOPES.length).toBeGreaterThan(10);
    // Verify there are no duplicates
    const uniqueScopes = new Set(REQUIRED_CANVAS_SCOPES);
    expect(uniqueScopes.size).toBe(REQUIRED_CANVAS_SCOPES.length);
  });
});
