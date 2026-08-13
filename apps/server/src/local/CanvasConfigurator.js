/**
 * CanvasConfigurator
 *
 * NOTA: La orquestacion real de Canvas Local (copiar/inyectar configuraciones
 * por defecto, levantar contenedores, validar la herramienta LTI y el script
 * JS) la ejecuta la capa Python de setup (ver apps/installer/src/installation/,
 * p.ej. bringup.py y verificar_plugin.py) invocada desde runPythonVerify().
 *
 * Esta clase es un punto de extension deliberadamente liviano: hoy no realiza
 * trabajo porque el pipeline Python ya lo cubre. Se mantiene para no romper
 * el flujo de arranque y para centralizar futuras configuraciones del backend
 * relacionadas con Canvas.
 */
import logger from '../utils/logger.js';

export default class CanvasConfigurator {
  static copyDefaultConfigs() {
    logger.info('[CONFIG] Copia de configs base delegada a la capa Python de setup.');
  }
}
