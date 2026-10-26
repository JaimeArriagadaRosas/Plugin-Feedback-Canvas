import { stopBackend, stopVite } from './process.js';
import { boot } from './boot/logger.js';

export function setupGracefulShutdown(backend, localOrchestrator) {
  let shutdownPromise;
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
    // Unregister before cleanup to prevent duplicate signal handlers.
    process.off('SIGINT', onSignal);
    process.off('SIGTERM', onSignal);
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
    await step('TLS proxy', async () => localOrchestrator?.stopTlsProxy?.());
    await step('Backend', async () => stopBackend(backend));
    await step('Vite', async () => stopVite());
    boot.success(errors ? 'Shutdown finished with warnings.' : 'Shutdown completed.');
    boot.endStage();
    process.exit(errors ? 1 : 0);
  }

  function shutdown() {
    if (!shutdownPromise) shutdownPromise = performShutdown();
    return shutdownPromise;
  }
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);
  return shutdown;
}
