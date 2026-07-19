import { inject } from 'vitest';

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
try {
  process.env.DATABASE_URL = inject('DATABASE_URL') || process.env.DATABASE_URL;
} catch (e) {
  // Ignore inject outside of vitest context
}
process.env.USE_LOCAL_DATA = 'true';
process.env.VITE_USE_LOCAL_DATA = process.env.VITE_USE_LOCAL_DATA || 'true';
process.env.LOCAL_USER_ROLE = process.env.LOCAL_USER_ROLE || 'teacher';
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-key';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';
process.env.LOCAL_DEV_PASSWORD_HASH = process.env.LOCAL_DEV_PASSWORD_HASH || '$2b$10$k2MaKxvssE3FyMd8E1w8p.oV8ikM4kOULPOQfn5dOCf/DqguhcGg2';
process.env.DEV_TOKEN_SECRET = process.env.DEV_TOKEN_SECRET || 'test-dev-token-secret';
process.env.WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'whsec_123456';
// Habilita el bypass de autenticación FIRMADO solo en entorno de prueba.
process.env.ENABLE_TEST_AUTH_BYPASS = 'true';
