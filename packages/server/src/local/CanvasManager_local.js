/**
 * CanvasLocalManager
 *
 * NOTA: El levantamiento e inicializacion del stack de Canvas Local en Docker
 * (docker compose up, healthcheck, inyeccion de plugin) lo realiza la capa
 * Python de setup (bringup.py / verificar_plugin.py), no este modulo.
 *
 * Este manager es el punto de extension para habilitar/deshabilitar el proxy
 * del backend hacia Canvas Local. Hoy la inicializacion de Docker queda a
 * cargo del pipeline Python; el backend solo senala que el entorno local
 * (proxy) esta listo para usarse.
 */
import logger from '../utils/logger.js';
import { pingCanvasAPI } from '../orchestration/boot/setup/utils/TokenManager.js';

class CanvasLocalManager {
  static async autoStartAndInitialize() {
    logger.info('[CANVAS] Esperando a que el servidor de Canvas (Puma) inicie...');
    while (true) {
        const { ready } = await pingCanvasAPI();
        if (ready) break;
        await new Promise(r => setTimeout(r, 5000));
    }
    logger.info('[CANVAS] Entorno Canvas Local listo (Puma respondiendo). Proxy habilitado.');
  }
}

export default CanvasLocalManager;
