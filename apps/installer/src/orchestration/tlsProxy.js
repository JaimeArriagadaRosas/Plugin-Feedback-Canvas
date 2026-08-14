/**
 * Orchestration bridge to the reverse TLS proxy module for Local Canvas.
 *
 * The real module is apps/installer/src/local/TlsProxyServer.js (outside src/). This
 * file re-exports its functions so that main.js (in src/orchestration)
 * can import it with a short relative path.
 */

export { startTlsProxy, stopTlsProxy } from '../local/TlsProxyServer.js';
