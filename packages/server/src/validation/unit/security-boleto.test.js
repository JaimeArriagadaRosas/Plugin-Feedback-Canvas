import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const SAVED = { ...process.env };

beforeEach(() => {
  for (const k of Object.keys(process.env)) delete process.env[k];
  process.env.NODE_ENV = 'test';
  process.env.DEV_TOKEN_SECRET = 'test-secret-key-32ch';
});

afterEach(() => {
  for (const k of Object.keys(process.env)) delete process.env[k];
  Object.assign(process.env, SAVED);
});

describe('BOLA prevention (OWASP API1:2023)', () => {
  it('rateByStudent rechaza si ltiContext.studentId no coincide con feedback', async () => {
    const mockRepo = {
      getById: vi.fn().mockResolvedValue({ estudiante_id: 999, id: 1 }),
      updateEstudianteRating: vi.fn()
    };

    const { default: FeedbackQueryService } = await import('../../services/FeedbackQueryService.js');
    const service = new FeedbackQueryService(mockRepo, {}, {}, {});

    await expect(
      service.rateByStudent(1, 5, { studentId: 123 })
    ).rejects.toThrow('Acceso denegado: no puedes calificar el feedback de otro estudiante');
  });

  it('rateByStudent permite si ltiContext.studentId coincide', async () => {
    const mockRepo = {
      getById: vi.fn().mockResolvedValue({ estudiante_id: 123, id: 1 }),
      updateEstudianteRating: vi.fn().mockResolvedValue({ rows: [{ id: 1 }] })
    };

    const { default: FeedbackQueryService } = await import('../../services/FeedbackQueryService.js');
    const service = new FeedbackQueryService(mockRepo, {}, {}, {});

    await expect(
      service.rateByStudent(1, 5, { studentId: 123 })
    ).resolves.toBeUndefined();
  });
});