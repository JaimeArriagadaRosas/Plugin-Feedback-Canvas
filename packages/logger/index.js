import pino from 'pino';

const isBrowser = typeof window !== 'undefined';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
    : undefined,
});

export default isBrowser
  ? { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, fatal: () => {}, child: () => this, request: () => '', get logFile() { return null; } }
  : logger;
export const Logger = pino.Logger;