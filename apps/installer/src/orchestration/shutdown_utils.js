import { stopBackend, stopVite } from './process.js';
import { boot } from './boot/logger.js';

export function setupGracefulShutdown(backend, localOrchestrator) {
  let isShuttingDown = false;
  
  const shutdown = async () => {
    if (isShuttingDown) {
      // If it is already shutting down and receives another signal (e.g. second Ctrl+C), exit immediately
      process.exit(1);
    }
    isShuttingDown = true;

    // Restore normal terminal behavior to allow
    // the CMD prompt (Batch job) or bash after finishing
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
      process.stdin.pause();
    }

    // Show the messages IMMEDIATELY so they don't get messed up with anything external
    process.stdout.write('\n');
    boot.stage('Shutting down system (Graceful Shutdown)');
    boot.info('Shutdown signal received. Closing services...');

    if (localOrchestrator && typeof localOrchestrator.stopTlsProxy === 'function') {
      await localOrchestrator.stopTlsProxy();
      boot.info('TLS Proxy stopped.');
    }
    
    if (backend) {
      try { 
        await stopBackend(backend); 
        boot.info('HTTP Server and PostgreSQL Pool closed.');
      } catch { /* ignore */ }
    }
    await stopVite();
    boot.info('Vite processes started by the plugin stopped.');
    
    boot.success('Process terminated correctly.');
    boot.endStage();
    
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Capture raw Ctrl+C (0x03) to prevent printing "^C" on screen
  // and, in Windows, prevent CMD from asking "Terminate batch job?" prematurely.
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (key) => {
      // Ctrl+C es \u0003, Ctrl+D es \u0004
      if (key === '\u0003' || key === '\u0004') {
        shutdown();
      }
    });
  }

  return shutdown;
}
