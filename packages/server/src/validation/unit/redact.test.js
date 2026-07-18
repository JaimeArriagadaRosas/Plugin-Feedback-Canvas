import { describe, it, expect, afterEach } from 'vitest';
import { redactByKey, redactSensitiveStrings, REDACT_PATHS } from '../../security/redact.js';

describe('security/redact', () => {
  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
  });

  it('redactByKey censura claves sensibles conocidas', () => {
    expect(redactByKey('password', 'secreto123')).toBe('[REDACTED]');
    expect(redactByKey('WEBHOOK_SECRET', 'whsec_x')).toBe('[REDACTED]');
    expect(redactByKey('body.password', 'secreto123')).toBe('[REDACTED]');
  });

  it('redactByKey preserva valores de claves no sensibles', () => {
    expect(redactByKey('nombre', 'Juan')).toBe('Juan');
    expect(redactByKey('rol', 'teacher')).toBe('teacher');
  });

  it('REDACT_PATHS cubre profundidad arbitraria (**.)', () => {
    expect(REDACT_PATHS).toContain('**.password');
    expect(REDACT_PATHS).toContain('**.ENCRYPTION_KEY');
  });

  it('redactSensitiveStrings reemplaza valores reales de secreto en el texto', () => {
    process.env.GEMINI_API_KEY = 'clave-super-secreta-de-prueba';
    const log = 'Llamada a Gemini con apiKey=clave-super-secreta-de-prueba y query X';
    expect(redactSensitiveStrings(log)).toBe('Llamada a Gemini con apiKey=[REDACTED] y query X');
  });

  it('redactSensitiveStrings no altera texto sin secretos', () => {
    expect(redactSensitiveStrings('ruta /api/courses respondió 200')).toBe('ruta /api/courses respondió 200');
  });
});
