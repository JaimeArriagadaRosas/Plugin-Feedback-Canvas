import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const env = vi.hoisted(() => ({ stored: {}, writes: [] }));
vi.mock('../../src/orchestration/envWriter.js', () => ({
  getEnvVar: (_dir, key) => env.stored[key],
  updateEnvVars: (_dir, changes) => env.writes.push(changes)
}));
import KeyManager from '../../src/config/KeyManager.js';

const names = ['ENCRYPTION_KEY','WEBHOOK_SECRET','DEV_TOKEN_SECRET'];
const synthetic = Object.fromEntries(names.map((n,i) => [n, String(i+1).repeat(64)]));
let backup;
beforeEach(() => {
  backup = Object.fromEntries([...names,'KEYS_REGENERATED'].map(n=>[n,process.env[n]]));
  names.forEach(n=>{delete process.env[n]});
  delete process.env.KEYS_REGENERATED;
  env.stored = { ...synthetic };
  env.writes = [];
});
afterEach(() => {
  for (const [n,v] of Object.entries(backup)) { if(v===undefined) delete process.env[n]; else process.env[n]=v; }
});

describe('KeyManager local key lifecycle diagnostics (synthetic values only)', () => {
  it('keeps valid persisted keys unchanged across consecutive startups', () => {
    KeyManager.ensureKeys('/synthetic', {});
    KeyManager.ensureKeys('/synthetic', {});
    expect(env.writes).toHaveLength(0);
    expect(process.env.KEYS_REGENERATED).toBeUndefined();
  });
  it('currently regenerates encryption key when the stored value is missing', () => {
    delete env.stored.ENCRYPTION_KEY;
    KeyManager.ensureKeys('/synthetic', {});
    expect(env.writes).toHaveLength(1);
    expect(env.writes[0].ENCRYPTION_KEY).toMatch(/^[0-9a-f]{64}$/);
    expect(process.env.KEYS_REGENERATED).toBe('true');
  });
  it('currently regenerates encryption key when it has invalid length', () => {
    env.stored.ENCRYPTION_KEY = 'incorrect';
    KeyManager.ensureKeys('/synthetic', {});
    expect(env.writes).toHaveLength(1);
    expect(env.writes[0].ENCRYPTION_KEY).toMatch(/^[0-9a-f]{64}$/);
  });
  it('does not overwrite a valid length persisted encryption key', () => {
    KeyManager.ensureKeys('/synthetic', {});
    expect(env.writes).toHaveLength(0);
  });
});
