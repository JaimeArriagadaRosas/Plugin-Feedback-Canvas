const LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const COLORS = {
  debug: '#777',
  info: '#0770a3',
  warn: '#b58900',
  error: '#c0392b',
};

const isDev = import.meta.env.DEV;

function formatTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

function shouldLog(level) {
  if (isDev) return true;
  return LEVELS[level] >= LEVELS.warn;
}

function log(level, module, message, payload = null) {
  if (!shouldLog(level)) return;

  const color = COLORS[level] || '#333';
  const prefix = `%c[${formatTimestamp()}] [${level.toUpperCase()}] [${module}]`;
  const suffix = ` %c${message}`;
  const style = `color: ${color}; font-weight: bold;`;
  const style2 = 'color: inherit;';

  if (payload !== null) {
    console.groupCollapsed(prefix + suffix, style, style2);
    console.log('Payload:', payload);
    console.groupEnd();
  } else {
    console.log(prefix + suffix, style, style2);
  }
}

export const logger = {
  debug: (module, message, payload) => log('debug', module, message, payload),
  info: (module, message, payload) => log('info', module, message, payload),
  warn: (module, message, payload) => log('warn', module, message, payload),
  error: (module, message, payload) => log('error', module, message, payload),
};

export default logger;
