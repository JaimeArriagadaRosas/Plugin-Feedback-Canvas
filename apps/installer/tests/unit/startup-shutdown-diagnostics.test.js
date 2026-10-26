import { describe, it, expect, vi, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';

const mocks = vi.hoisted(() => ({
  stopBackend: vi.fn(),
  stopVite: vi.fn(),
  boot: { stage:vi.fn(), info:vi.fn(),success:vi.fn(),endStage:vi.fn() }
}));
vi.mock('../../src/orchestration/process.js', () => ({
  stopBackend: mocks.stopBackend,
  stopVite: mocks.stopVite
}));
vi.mock('../../src/orchestration/boot/logger.js', () => ({ boot:mocks.boot }));
import { setupGracefulShutdown } from '../../src/orchestration/shutdown_utils.js';
const { stopBackend: actualStopChild } = await vi.importActual('../../src/orchestration/process.js');

const attached=[];
afterEach(() => {
  for (const fn of attached.splice(0)) {
    process.off('SIGINT', fn);
    process.off('SIGTERM', fn);
  }
  vi.restoreAllMocks();
  mocks.stopBackend.mockReset();
  mocks.stopVite.mockReset();
});

describe('shutdown simulations (non-destructive)', () => {
  it('normal shutdown calls TLS, backend and Vite once then exits 0', async () => {
    const order=[];
    const tls = {stopTlsProxy: vi.fn(async () => {order.push('tls');})};
    mocks.stopBackend.mockImplementation(async () => {order.push('backend');});
    mocks.stopVite.mockImplementation(async () => {order.push('vite');});
    const exit = vi.spyOn(process,'exit').mockImplementation(code=>{throw new Error('EXPECTED_EXIT_'+code)});
    const handler=setupGracefulShutdown({pid:12345}, tls);
    attached.push(handler);
    await expect(handler()).rejects.toThrow('EXPECTED_EXIT_0');
    expect(order).toEqual(['tls','backend','vite']);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('a stuck backend prevents graceful exit forever (no deadline)', async () => {
    mocks.stopBackend.mockImplementation(() => new Promise(()=>{}));
    const exit = vi.spyOn(process,'exit').mockImplementation(()=>{throw new Error('UNEXPECTED_EXIT')});
    const handler=setupGracefulShutdown({pid:12345}, null);
    attached.push(handler);
    const running=handler();
    const state=await Promise.race([running.then(()=> 'settled'),new Promise(resolve=>setTimeout(()=>resolve('still-pending'),60))]);
    expect(state).toBe('still-pending');
    expect(exit).not.toHaveBeenCalled();
    expect(mocks.stopVite).not.toHaveBeenCalled();
  });

  it('a second Ctrl+C causes immediate exit 1 (potentially skips cleanup)', async () => {
    mocks.stopBackend.mockImplementation(() => new Promise(()=>{}));
    const exit = vi.spyOn(process,'exit').mockImplementation(code=>{throw new Error('EXPECTED_EXIT_'+code)});
    const handler=setupGracefulShutdown({pid:12345}, null);
    attached.push(handler);
    void handler();
    await expect(handler()).rejects.toThrow('EXPECTED_EXIT_1');
    expect(exit).toHaveBeenCalledWith(1);
    expect(mocks.stopVite).not.toHaveBeenCalled();
  });
});

describe('child process shutdown primitives', () => {
  it('stopBackend waits indefinitely if a child ignores SIGINT', async () => {
    const child=new EventEmitter();
    child.killed=false;
    child.kill=vi.fn().mockReturnValue(true);
    const promise=actualStopChild(child);
    const outcome=await Promise.race([promise.then(()=> 'completed'),new Promise(resolve=>setTimeout(()=>resolve('pending'),60))]);
    expect(outcome).toBe('pending');
    expect(child.kill).toHaveBeenCalledWith('SIGINT');
    child.emit('exit',0);
    await expect(promise).resolves.toBeUndefined();
  });
});
