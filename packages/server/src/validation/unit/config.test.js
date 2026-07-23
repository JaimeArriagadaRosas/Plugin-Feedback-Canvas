import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getEnv,
  getEnvBool,
  setEnv,
  isProduction,
  isLocalDataEnabled,
  getCanvasEnv,
} from '../../config/index.js';
import {
  SECRET_REGISTRY,
  validateSecretsOrThrow,
  getSecret,
  maskSecret,
} from '../../config/secrets.js';
import logger from '../../utils/logger.js';

const SAVED = { ...process.env };

beforeEach(() => {
  // Aislar de la configuración real del host.
  for (const k of Object.keys(process.env)) delete process.env[k];
  process.env.NODE_ENV = 'test';
});

afterEach(() => {
  for (const k of Object.keys(process.env)) delete process.env[k];
  Object.assign(process.env, SAVED);
});

describe('config/index.js', () => {
  it('getEnv devuelve el valor real y respeta el fallback', () => {
    process.env.MI_VAR = 'valor';
    expect(getEnv('MI_VAR', 'def')).toBe('valor');
    expect(getEnv('NO_EXISTE', 'def')).toBe('def');
  });

  it('getEnv trata cadenas vacías como ausentes', () => {
    process.env.VACIA = '';
    expect(getEnv('VACIA', 'def')).toBe('def');
  });

  it('getEnvBool interpreta true/1', () => {
    process.env.B1 = 'true';
    process.env.B2 = '1';
    process.env.B3 = 'false';
    expect(getEnvBool('B1')).toBe(true);
    expect(getEnvBool('B2')).toBe(true);
    expect(getEnvBool('B3')).toBe(false);
    expect(getEnvBool('AUSENTE', true)).toBe(true);
  });

  it('setEnv escribe y borra (mutación en runtime preservada)', () => {
    setEnv('X', '1');
    expect(process.env.X).toBe('1');
    setEnv('X', undefined);
    expect(process.env.X).toBeUndefined();
  });

  it('isProduction refleja NODE_ENV', () => {
    process.env.NODE_ENV = 'production';
    expect(isProduction()).toBe(true);
    process.env.NODE_ENV = 'development';
    expect(isProduction()).toBe(false);
  });

  it('isLocalDataEnabled combina USE_LOCAL_DATA y VITE_USE_LOCAL_DATA', () => {
    process.env.VITE_USE_LOCAL_DATA = 'true';
    expect(isLocalDataEnabled()).toBe(true);
    delete process.env.VITE_USE_LOCAL_DATA;
    process.env.USE_LOCAL_DATA = 'true';
    expect(isLocalDataEnabled()).toBe(true);
  });

  it('getCanvasEnv prefiere la clave backend y avisa con la VITE_', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.VITE_CANVAS_BASE_URL = 'https://vite.example';
    expect(getCanvasEnv('CANVAS_BASE_URL', 'VITE_CANVAS_BASE_URL')).toBe('https://vite.example');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('getCanvasEnv usa la clave backend sin avisar cuando existe', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.CANVAS_BASE_URL = 'https://real.example';
    process.env.VITE_CANVAS_BASE_URL = 'https://vite.example';
    expect(getCanvasEnv('CANVAS_BASE_URL', 'VITE_CANVAS_BASE_URL')).toBe('https://real.example');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('config/secrets.js', () => {
  it('getSecret es un proxy sobre process.env', () => {
    process.env.WEBHOOK_SECRET = 'abc';
    expect(getSecret('WEBHOOK_SECRET')).toBe('abc');
  });

  it('maskSecret oculta todo salvo los últimos 4', () => {
    expect(maskSecret('supersecret1234')).toBe('****1234');
    expect(maskSecret('')).toBe('<vacío>');
    expect(maskSecret('ab')).toBe('****');
  });

  it('en no-producción solo advierte (no lanza) con placeholder', () => {
    process.env.NODE_ENV = 'development';
    process.env.WEBHOOK_SECRET = 'change_me';
    process.env.DB_PASSWORD = 'realpass';
    process.env.ENCRYPTION_KEY = '1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!@';
    process.env.DEV_TOKEN_SECRET = 'dev_token_secret_123';
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const problems = validateSecretsOrThrow(SECRET_REGISTRY);
    expect(problems).toContain('WEBHOOK_SECRET');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('en no-producción no lanza si falta un secreto no requerido', () => {
    process.env.NODE_ENV = 'development';
    process.env.DB_PASSWORD = 'realpass';
    process.env.ENCRYPTION_KEY = '1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!@';
    process.env.DEV_TOKEN_SECRET = 'dev_token_secret_123';
    expect(() => validateSecretsOrThrow(SECRET_REGISTRY)).not.toThrow();
  });

  it('en producción LANZA si falta un secreto requerido', () => {
    process.env.NODE_ENV = 'production';
    process.env.WEBHOOK_SECRET = 'change_me_please';
    // DB_PASSWORD y ENCRYPTION_KEY ausentes -> requeridos
    expect(() => validateSecretsOrThrow(SECRET_REGISTRY)).toThrow(/producción/);
  });

  it('en producción LANZA si hay placeholder en secreto requerido', () => {
    process.env.NODE_ENV = 'production';
    process.env.DB_PASSWORD = 'changeme';
    process.env.ENCRYPTION_KEY = '1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!@';
    process.env.DEV_TOKEN_SECRET = 'dev_token_secret_123';
    expect(() => validateSecretsOrThrow(SECRET_REGISTRY)).toThrow(/producción/);
  });

  it('en producción no lanza con todos los requeridos válidos', () => {
    process.env.NODE_ENV = 'production';
    process.env.DB_PASSWORD = 'realpass';
    process.env.ENCRYPTION_KEY = '1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!@';
    process.env.DEV_TOKEN_SECRET = 'dev_token_secret_123';
    process.env.WEBHOOK_SECRET = 'whsec_123456';
    expect(() => validateSecretsOrThrow(SECRET_REGISTRY)).not.toThrow();
  });
});
