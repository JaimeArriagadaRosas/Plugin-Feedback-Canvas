/**
 * Puente de orquestación al módulo de proxy TLS inverso para Canvas Local.
 *
 * El módulo real vive en scripts/tls-proxy/index.js (fuera de src/). Este
 * archivo re-exporta sus funciones para que main.js (en src/orchestration)
 * pueda importarlo con una ruta relativa corta.
 */

export { startTlsProxy, stopTlsProxy } from '../../../../scripts/tls-proxy/index.js';
