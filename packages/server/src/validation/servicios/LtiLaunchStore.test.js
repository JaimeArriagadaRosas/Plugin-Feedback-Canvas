import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setLtiState, getLtiState, delLtiState, initLtiStore } from '../../stores/LtiLaunchStore.js';

describe('LtiLaunchStore  Black box (memory mode)', () => {
  beforeEach(async () => {
    process.env.REDIS_URL = '';
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('set/get/del funciona en modo memoria', async () => {
    await initLtiStore();
    await setLtiState('test-key', { state: 'abc', nonce: 'xyz' });
    
    const val = await getLtiState('test-key');
    expect(val).toEqual({ state: 'abc', nonce: 'xyz' });
  });

  it('elimina automticamente tras TTL (simulado)', async () => {
    await initLtiStore();
    await setLtiState('expire-key', { foo: 'bar' });
    
    expect(await getLtiState('expire-key')).toEqual({ foo: 'bar' });
    
    vi.advanceTimersByTime(601 * 1000);
    await Promise.resolve();
    
    expect(await getLtiState('expire-key')).toBe(null);
  });

  it('delLtiState elimina el valor', async () => {
    await initLtiStore();
    await setLtiState('del-key', { remove: true });
    await delLtiState('del-key');
    
    expect(await getLtiState('del-key')).toBe(null);
  });
});
