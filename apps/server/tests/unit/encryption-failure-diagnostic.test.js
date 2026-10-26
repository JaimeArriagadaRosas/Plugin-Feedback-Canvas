import { describe, it, expect, vi } from 'vitest';

const fixture = 'ab'.repeat(32); // synthetic key, never a deployed secret
vi.mock('../../src/config/secrets.js', () => ({ getSecret: () => fixture }));
vi.mock('../../src/utils/logger.js', () => ({ default: { error: vi.fn() } }));
import EncryptionService from '../../src/services/infrastructure/EncryptionService.js';

describe('Encrypted credential failure diagnostics with synthetic data', () => {
  it('round-trips an intact credential', () => {
    const stored = EncryptionService.encrypt('fictional-refresh-token');
    expect(EncryptionService.decrypt(stored)).toBe('fictional-refresh-token');
  });
  it('fails closed on a modified AES-GCM authentication tag', () => {
    const stored = EncryptionService.encrypt('fictional-access-token');
    const parts = stored.split(':');
    parts[1] = (parts[1][0] === 'a' ? 'b' : 'a') + parts[1].slice(1);
    expect(EncryptionService.safeDecrypt(parts.join(':'), 'synthetic', true)).toBeNull();
  });
  it('fails closed on malformed ciphertext instead of returning credentials', () => {
    expect(EncryptionService.safeDecrypt('bad-ciphertext', 'synthetic', true)).toBeNull();
  });
});
