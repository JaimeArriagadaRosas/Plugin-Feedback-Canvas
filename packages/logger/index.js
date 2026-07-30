import pino from 'pino';

const isBrowser = typeof window !== 'undefined';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { 
        target: 'pino-pretty', 
        options: { 
          colorize: true, 
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
          singleLine: true,
          messageFormat: '{msg}'
        } 
      }
    : undefined,
});

// Implementación dummy para el navegador para evitar crashes si se importa allí
export default isBrowser
  ? { 
      info: console.info, 
      warn: console.warn, 
      error: console.error, 
      debug: console.debug, 
      fatal: console.error, 
      child: () => this, 
      request: () => '', 
      get logFile() { return null; } 
    }
  : logger;

export const Logger = pino.Logger;