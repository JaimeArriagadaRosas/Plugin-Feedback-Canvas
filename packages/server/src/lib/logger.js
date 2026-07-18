/**
 * FrontendLogger — Logging estructurado para depuración del cliente.
 *
 * Extraído de main.jsx para poder reutilizarlo desde cualquier módulo
 * del frontend sin acoplarlo al punto de entrada.
 */
const PREFIX = '[PluginFeedback]';

const FrontendLogger = {
  info: (...args) => console.info(PREFIX, ...args),
  warn: (...args) => console.warn(PREFIX, ...args),
  error: (...args) => console.error(PREFIX, ...args),
  debug: (...args) => {
    if (import.meta.env.DEV) console.debug(PREFIX + '[DEBUG]', ...args);
  },
  group: (label, fn) => {
    if (import.meta.env.DEV) {
      console.group(PREFIX + ' ' + label);
      fn();
      console.groupEnd();
    } else {
      fn();
    }
  },
};

export default FrontendLogger;
