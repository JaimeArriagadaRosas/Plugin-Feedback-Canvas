import { clearPorts } from './portManager.js';
import { stopBackend, VITE_PORT, SERVER_PORT } from './process.js';
import { boot } from './boot/logger.js';

export function setupGracefulShutdown(backend, localOrchestrator) {
  let isShuttingDown = false;
  
  const shutdown = async () => {
    if (isShuttingDown) {
      // Si ya está apagándose y recibe otra señal (ej. segundo Ctrl+C), salir inmediatamente
      process.exit(1);
    }
    isShuttingDown = true;

    // Restaurar el comportamiento normal de la terminal para permitir 
    // el prompt de CMD (Trabajo por lotes) tras finalizar o en el segundo Ctrl+C
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
      process.stdin.pause();
    }

    // Mostrar los mensajes INMEDIATAMENTE para que no se desordenen con nada externo
    process.stdout.write('\n');
    boot.stage('Apagando sistema (Graceful Shutdown)');
    boot.info('Recibida señal de apagado. Cerrando servicios...');

    if (localOrchestrator && typeof localOrchestrator.stopTlsProxy === 'function') {
      await localOrchestrator.stopTlsProxy();
      boot.info('Proxy TLS detenido.');
    }
    
    if (backend) {
      try { 
        await stopBackend(backend); 
        boot.info('Servidor HTTP y Pool de PostgreSQL cerrados.');
      } catch { /* ignore */ }
    }
    
    boot.info('Limpiando procesos previos en puertos 5173 y 3000...');
    try {
      await clearPorts(VITE_PORT, SERVER_PORT);
      boot.success('Puertos liberados.');
    } catch { /* ignore */ }
    
    boot.success('Proceso terminado correctamente.');
    boot.endStage();
    
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Capturar Ctrl+C (0x03) crudo para evitar que CMD pregunte "¿Desea terminar el trabajo por lotes?" 
  // prematuramente. El primer Ctrl+C es gestionado silenciosamente.
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
