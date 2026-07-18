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
class CanvasLocalManager {
  static async autoStartAndInitialize() {
    console.info('[CanvasLocalManager] Entorno Canvas Local listo (orquestacion Docker delegada a la capa Python de setup). Proxy habilitado.');
  }
}

export default CanvasLocalManager;
