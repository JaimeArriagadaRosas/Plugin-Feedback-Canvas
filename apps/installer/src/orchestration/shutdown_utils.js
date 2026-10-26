import { stopBackend, stopVite } from './process.js';
import { boot } from './boot/logger.js';

export function setupGracefulShutdown(backend, localOrchestrator, { isStarted = () => true } = {}) {
  const getBackend = typeof backend === 'function' ? backend : () => backend;
  const getOrchestrator = typeof localOrchestrator === 'function' ? localOrchestrator : () => localOrchestrator;
  let shutdownPromise;
  let failed = false;
  const onSignal = () => { void shutdown().catch(error => { boot.error(error.message); process.exit(1); }); };
  const onInput = key => { if (key === '\u0003' || key === '\u0004') onSignal(); };
  let rawOwned = false;
  if (process.stdin.isTTY && typeof process.stdin.setRawMode === 'function') {
    process.stdin.setRawMode(true);
    rawOwned = true;
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', onInput);
  }

  async function performShutdown() {
    // Keep signal handlers active during cleanup: repeated Ctrl+C must join
    // the same shutdown, not terminate a half-closed process by default.
    process.stdin.off('data', onInput);
    if (rawOwned) process.stdin.setRawMode(false);
    if (process.stdin.isTTY) process.stdin.pause();
    process.stdout.write('\n');
    boot.stage('Shutting down system (Graceful Shutdown)');
    boot.info('Shutdown signal received. Closing owned services...');
    let errors = 0;
    async function step(label, fn) {
      let timer;
      try {
        await Promise.race([Promise.resolve().then(fn), new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Shutdown deadline exceeded')), 8000);
        })]);
        boot.info(label + ' stopped.');
      } catch (error) {
        errors++;
        boot.warn?.(label + ': ' + error.message);
      } finally { clearTimeout(timer); }
    }
    await step('TLS proxy', async () => getOrchestrator()?.stopTlsProxy?.());
    await step('Backend', async () => stopBackend(getBackend()));
    await step('Vite', async () => stopVite());
    boot.success(errors ? 'Shutdown finished with warnings.' : 'Shutdown completed.');
    boot.endStage();
    process.off('SIGINT', onSignal);
    process.off('SIGTERM', onSignal);
    process.exit(errors || failed ? 1 : isStarted() ? 0 : 130);
  }

  function shutdown({ failure = false } = {}) {
    if (failure) failed = true;
    if (!shutdownPromise) shutdownPromise = performShutdown();
    return shutdownPromise;
  }
  shutdown.isStopping = () => Boolean(shutdownPromise);
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);
  return shutdown;
}
